import { NextResponse } from "next/server";
import {
    getLinks,
    createLink,
    getFiles,
    createFile,
    renameFile,
    deleteFile,
    moveFileToFolder,
    getTasks,
    createTask,
    updateTaskStatus,
    getMeetingNotes,
    createMeetingNote,
    getAgreementNotes,
    createAgreementNote,
    updateAgreementNote,
} from "@/lib/db/workspace";
import { getTeamById, getTeamMembers, isActiveMemberStatus, updateTeamMemberRole } from "@/lib/db/teams";
import { syncAcceptedTeamMembershipsForUser } from "@/lib/db/requests";
import { listUsers } from "@/lib/db/users";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { appendAuditLog } from "@/lib/db/audit";

interface WorkspaceCacheEntry {
    expiresAt: number;
    payload: unknown;
}

interface WorkspaceSyncEntry {
    expiresAt: number;
}

type WorkspaceFileScope = "team" | "user";

const WORKSPACE_CACHE_TTL_MS = 10_000;
const WORKSPACE_SYNC_TTL_MS = 45_000;
const WORKSPACE_PRESENCE_ACTIVE_MS = 35_000;
const WORKSPACE_PRESENCE_AWAY_MS = 120_000;

declare global {
    var __onbureWorkspaceCache: Map<string, WorkspaceCacheEntry> | undefined;
    var __onbureWorkspaceSyncCache: Map<string, WorkspaceSyncEntry> | undefined;
    var __onbureWorkspacePresence: Map<string, number> | undefined;
}

const workspaceCache =
    globalThis.__onbureWorkspaceCache ||
    (globalThis.__onbureWorkspaceCache = new Map<string, WorkspaceCacheEntry>());
const workspaceSyncCache =
    globalThis.__onbureWorkspaceSyncCache ||
    (globalThis.__onbureWorkspaceSyncCache = new Map<string, WorkspaceSyncEntry>());
const workspacePresence =
    globalThis.__onbureWorkspacePresence ||
    (globalThis.__onbureWorkspacePresence = new Map<string, number>());

function unauthorizedResponse() {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function hasSessionCookie(req: Request): boolean {
    const cookieHeader = String(req.headers.get("cookie") || "");
    if (!cookieHeader) return false;

    return (
        cookieHeader.includes("next-auth.session-token=") ||
        cookieHeader.includes("__Secure-next-auth.session-token=") ||
        cookieHeader.includes("authjs.session-token=") ||
        cookieHeader.includes("__Secure-authjs.session-token=")
    );
}

async function resolveAuthenticatedUserId() {
    try {
        const session = await getServerSession(authOptions);
        const userId = String((session?.user as { id?: string } | undefined)?.id || "").trim();
        if (!session || !userId) return null;
        return userId;
    } catch (error) {
        console.error("Failed to resolve session in /api/workspace/[teamId]", error);
        return null;
    }
}

function isNotionRateLimitedError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes("Notion API Error [429]") || message.includes("\"code\":\"rate_limited\"");
}

function getWorkspaceCacheKey(userId: string, teamId: string) {
    return `${userId}:${teamId}`;
}

function getWorkspacePresenceKey(teamId: string, userId: string) {
    return `${teamId}:${userId}`;
}

function pruneWorkspacePresence(now: number) {
    if (workspacePresence.size <= 1500) return;
    const staleCutoff = now - WORKSPACE_PRESENCE_AWAY_MS * 10;
    for (const [key, seenAt] of workspacePresence.entries()) {
        if (seenAt < staleCutoff) workspacePresence.delete(key);
    }
}

function markWorkspacePresence(teamId: string, userId: string, now: number) {
    workspacePresence.set(getWorkspacePresenceKey(teamId, userId), now);
    pruneWorkspacePresence(now);
}

function resolvePresenceStatus(teamId: string, viewerUserId: string, memberUserId: string, status: string, now: number) {
    if (memberUserId === viewerUserId) return "Active";

    const normalized = String(status || "").trim().toLowerCase();
    if (normalized.includes("inactive") || normalized.includes("offline")) return "Inactive";
    if (normalized.includes("away") || normalized.includes("idle") || normalized.includes("break")) return "Away";

    const seenAt = workspacePresence.get(getWorkspacePresenceKey(teamId, memberUserId));
    if (!seenAt) return "Inactive";

    const age = now - seenAt;
    if (age <= WORKSPACE_PRESENCE_ACTIVE_MS) return "Active";
    if (age <= WORKSPACE_PRESENCE_AWAY_MS) return "Away";
    return "Inactive";
}

function rankStatus(status: string) {
    const normalized = String(status || "").trim().toLowerCase();
    if (normalized.includes("active")) return 0;
    if (normalized.includes("away")) return 1;
    return 2;
}

function resolveWorkspaceFileScope(value: unknown): WorkspaceFileScope {
    return String(value || "").trim().toLowerCase() === "my" ? "user" : "team";
}

function applyPresenceToMembers<T extends { userId: string; status: string; username?: string }>(
    teamId: string,
    viewerUserId: string,
    members: T[],
    now: number
) {
    return members
        .map((member) => ({
            ...member,
            status: resolvePresenceStatus(teamId, viewerUserId, member.userId, member.status, now),
        }))
        .sort((a, b) => {
            const rankDiff = rankStatus(a.status) - rankStatus(b.status);
            if (rankDiff !== 0) return rankDiff;
            return String(a.username || "").localeCompare(String(b.username || ""));
        });
}

function invalidateWorkspaceTeamCache(teamId: string) {
    const suffix = `:${teamId}`;
    for (const key of workspaceCache.keys()) {
        if (key.endsWith(suffix)) {
            workspaceCache.delete(key);
        }
    }
}

async function assertActiveTeamMember(teamId: string, userId: string) {
    const team = await getTeamById(teamId);
    if (!team) {
        throw new Error("Team not found");
    }

    const members = await getTeamMembers(teamId);
    const isMember = members.some((member) => member.userId === userId && isActiveMemberStatus(member.status));
    if (!isMember) {
        throw new Error("Forbidden");
    }
}

export async function GET(req: Request, { params }: { params: Promise<{ teamId: string }> }) {
    if (!hasSessionCookie(req)) return unauthorizedResponse();
    const userId = await resolveAuthenticatedUserId();
    if (!userId) return unauthorizedResponse();
    const { teamId } = await params;
    const now = Date.now();
    markWorkspacePresence(teamId, userId, now);

    const cacheKey = getWorkspaceCacheKey(userId, teamId);
    const cached = workspaceCache.get(cacheKey);

    if (cached && cached.expiresAt > now) {
        const payload = cached.payload as {
            members?: Array<{ userId: string; status: string; username?: string }>;
            [key: string]: unknown;
        };
        const members = Array.isArray(payload?.members) ? payload.members : [];
        const membersWithPresence = applyPresenceToMembers(teamId, userId, members, now);
        return NextResponse.json({ ...payload, members: membersWithPresence });
    }

    try {
        const syncKey = getWorkspaceCacheKey(userId, teamId);
        const syncState = workspaceSyncCache.get(syncKey);
        if (!syncState || syncState.expiresAt <= now) {
            await syncAcceptedTeamMembershipsForUser(userId, teamId).catch((error) => {
                console.error("syncAcceptedTeamMembershipsForUser failed", error);
            });
            workspaceSyncCache.set(syncKey, { expiresAt: now + WORKSPACE_SYNC_TTL_MS });
        }

        const [team, members] = await Promise.all([getTeamById(teamId), getTeamMembers(teamId)]);
        if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

        const isMember = members.some((member) => member.userId === userId && isActiveMemberStatus(member.status));
        if (!isMember) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const [links, files, myFiles, tasks, meetingNotes, agreementNotes, users] = await Promise.all([
            getLinks(teamId),
            getFiles(teamId, { scope: "team" }),
            getFiles(teamId, { scope: "user", ownerUserId: userId }),
            getTasks(teamId),
            getMeetingNotes(teamId),
            getAgreementNotes(teamId),
            listUsers(),
        ]);

        const usernameByUserId = new Map(users.map((user) => [user.userId, user.username || user.userId]));
        const membersWithUsername = members.map((member) => ({
            ...member,
            username: usernameByUserId.get(member.userId) || member.userId,
        }));
        const sortedMembers = applyPresenceToMembers(teamId, userId, membersWithUsername, now);

        const payload = {
            team,
            links,
            files,
            myFiles,
            tasks,
            meetingNotes,
            agreementNotes,
            members: sortedMembers,
            viewerUserId: userId,
        };

        workspaceCache.set(cacheKey, {
            payload,
            expiresAt: now + WORKSPACE_CACHE_TTL_MS,
        });

        return NextResponse.json(payload);
    } catch (error) {
        if (isNotionRateLimitedError(error)) {
            if (cached?.payload) {
                return NextResponse.json(cached.payload);
            }
            return NextResponse.json(
                { error: "Rate limited by Notion. Please retry in a moment." },
                { status: 503 }
            );
        }
        console.error(error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: Request, { params }: { params: Promise<{ teamId: string }> }) {
    if (!hasSessionCookie(req)) return unauthorizedResponse();
    const currentUserId = await resolveAuthenticatedUserId();
    if (!currentUserId) return unauthorizedResponse();
    const { teamId } = await params;

    try {
        await syncAcceptedTeamMembershipsForUser(currentUserId, teamId).catch(() => undefined);
        await assertActiveTeamMember(teamId, currentUserId);

        const body = await req.json().catch(() => null);
        if (!body || typeof body !== "object") {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
        }
        const { type, title, url, content, status, scope } = body;
        const fileScope = resolveWorkspaceFileScope(scope);
        let createdFileId: string | null = null;

        if (type === "LINK") await createLink(teamId, title, url);
        else if (type === "FILE") {
            createdFileId = await createFile(teamId, title, url, {
                scope: fileScope,
                ownerUserId: fileScope === "user" ? currentUserId : undefined,
            });
        }
        else if (type === "TASK") await createTask(teamId, title, status);
        else if (type === "MEETING_NOTE") await createMeetingNote(teamId, title, content);
        else if (type === "AGREEMENT") await createAgreementNote(teamId, content);
        else return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

        invalidateWorkspaceTeamCache(teamId);
        await appendAuditLog({
            category: "workspace",
            event: "workspace_item_created",
            actorUserId: currentUserId,
            teamId,
            scope: type === "FILE" ? fileScope : "team",
            metadata: {
                type: String(type || ""),
                title: String(title || "").slice(0, 120),
            },
        });
        return NextResponse.json({ success: true, id: createdFileId });
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message === "Team not found") {
            return NextResponse.json({ error: "Team not found" }, { status: 404 });
        }
        if (message === "Forbidden") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const missingScopedFileColumns =
            message.includes("PGRST204") &&
            message.includes("workspace_files") &&
            (message.includes("scope") || message.includes("owner_user_id"));
        if (missingScopedFileColumns) {
            return NextResponse.json(
                {
                    error: "workspace_files.scope / owner_user_id is missing. Run the Supabase migration and reload schema cache.",
                },
                { status: 400 }
            );
        }
        console.error(error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ teamId: string }> }) {
    if (!hasSessionCookie(req)) return unauthorizedResponse();
    const currentUserId = await resolveAuthenticatedUserId();
    if (!currentUserId) return unauthorizedResponse();

    try {
        const { teamId } = await params;

        await syncAcceptedTeamMembershipsForUser(currentUserId, teamId).catch(() => undefined);
        await assertActiveTeamMember(teamId, currentUserId);

        const body = await req.json().catch(() => null);
        if (!body || typeof body !== "object") {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
        }
        const { type, id, title, content, status, folderId, userId, role, scope } = body;
        const fileScope = resolveWorkspaceFileScope(scope);

        if (type === "TASK_STATUS") await updateTaskStatus(id, status);
        else if (type === "AGREEMENT") await updateAgreementNote(id, content);
        else if (type === "FILE_RENAME") {
            await renameFile(teamId, id, title, {
                scope: fileScope,
                ownerUserId: fileScope === "user" ? currentUserId : undefined,
            });
        }
        else if (type === "FILE_FOLDER") {
            await moveFileToFolder(teamId, id, folderId, {
                scope: fileScope,
                ownerUserId: fileScope === "user" ? currentUserId : undefined,
            });
        }
        else if (type === "MEMBER_ROLE") {
            if (!currentUserId) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }

            const targetUserId = String(userId || "").trim();
            const nextRole = String(role || "").trim();
            if (!targetUserId || !["Admin", "Member"].includes(nextRole)) {
                return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
            }

            const members = await getTeamMembers(teamId);
            const ownerActor = members.find(
                (member) =>
                    member.userId === currentUserId &&
                    member.role === "Owner" &&
                    isActiveMemberStatus(member.status)
            );
            if (!ownerActor) {
                return NextResponse.json({ error: "Only owners can change roles." }, { status: 403 });
            }

            const targetMember = members.find(
                (member) => member.userId === targetUserId && isActiveMemberStatus(member.status)
            );
            if (!targetMember) {
                return NextResponse.json({ error: "Target member not found." }, { status: 404 });
            }
            if (targetMember.role === "Owner") {
                return NextResponse.json({ error: "Owner role cannot be changed." }, { status: 400 });
            }

            await updateTeamMemberRole(teamId, targetUserId, nextRole as "Admin" | "Member");
        }
        else {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
        }

        invalidateWorkspaceTeamCache(teamId);
        await appendAuditLog({
            category: "workspace",
            event: "workspace_item_updated",
            actorUserId: currentUserId,
            teamId,
            scope: type === "FILE_RENAME" || type === "FILE_FOLDER" ? fileScope : "team",
            metadata: {
                type: String(type || ""),
                id: String(id || ""),
                role: String(role || ""),
                userId: String(userId || ""),
            },
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "");
        if (message === "Team not found") {
            return NextResponse.json({ error: "Team not found" }, { status: 404 });
        }
        if (message === "Forbidden") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const missingFolderColumn =
            message.includes("PGRST204") &&
            message.includes("folder_id") &&
            message.includes("workspace_files");
        const missingScopedFileColumns =
            message.includes("PGRST204") &&
            message.includes("workspace_files") &&
            (message.includes("scope") || message.includes("owner_user_id"));
        if (missingFolderColumn) {
            return NextResponse.json(
                {
                    error: "workspace_files.folder_id is missing. Run the Supabase migration and reload schema cache.",
                },
                { status: 400 }
            );
        }
        if (missingScopedFileColumns) {
            return NextResponse.json(
                {
                    error: "workspace_files.scope / owner_user_id is missing. Run the Supabase migration and reload schema cache.",
                },
                { status: 400 }
            );
        }
        console.error(error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ teamId: string }> }) {
    if (!hasSessionCookie(req)) return unauthorizedResponse();
    const currentUserId = await resolveAuthenticatedUserId();
    if (!currentUserId) return unauthorizedResponse();

    try {
        const { teamId } = await params;

        await syncAcceptedTeamMembershipsForUser(currentUserId, teamId).catch(() => undefined);
        await assertActiveTeamMember(teamId, currentUserId);

        const body = await req.json().catch(() => ({}));
        const { type, id, scope } = body as { type?: string; id?: string; scope?: unknown };
        const fileScope = resolveWorkspaceFileScope(scope);

        if (type !== "FILE" || !String(id || "").trim()) {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
        }

        await deleteFile(teamId, String(id), {
            scope: fileScope,
            ownerUserId: fileScope === "user" ? currentUserId : undefined,
        });
        invalidateWorkspaceTeamCache(teamId);
        await appendAuditLog({
            category: "workspace",
            event: "workspace_item_deleted",
            actorUserId: currentUserId,
            teamId,
            scope: fileScope,
            metadata: {
                type: "FILE",
                id: String(id || ""),
            },
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message === "Team not found") {
            return NextResponse.json({ error: "Team not found" }, { status: 404 });
        }
        if (message === "Forbidden") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const missingScopedFileColumns =
            message.includes("PGRST204") &&
            message.includes("workspace_files") &&
            (message.includes("scope") || message.includes("owner_user_id"));
        if (missingScopedFileColumns) {
            return NextResponse.json(
                {
                    error: "workspace_files.scope / owner_user_id is missing. Run the Supabase migration and reload schema cache.",
                },
                { status: 400 }
            );
        }
        console.error(error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
