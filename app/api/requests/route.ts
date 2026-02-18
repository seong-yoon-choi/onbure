import { NextResponse } from "next/server";
import {
    createChatRequest,
    getChatRequestsForUserByStatuses,
    createTeamInvite,
    getTeamInvitesForUserByStatuses,
    createJoinRequest,
    getJoinApplicationsForManagerByStatuses,
    createFileShareRequest,
    getFileShareRequestsForUserByStatuses,
    updateRequestStatus,
    RequestConflictError,
    type RequestStatus,
    type RequestItem,
} from "@/lib/db/requests";
import { getTeamById } from "@/lib/db/teams";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { appendAuditLog } from "@/lib/db/audit";

interface RequestsPayload {
    requests: unknown[];
    history: unknown[];
}

interface RequestsCacheEntry {
    expiresAt: number;
    payload: RequestsPayload;
}

const REQUESTS_CACHE_TTL_MS = 8000;

declare global {
    var __onbureRequestsCache: Map<string, RequestsCacheEntry> | undefined;
}

const requestsCache =
    globalThis.__onbureRequestsCache ||
    (globalThis.__onbureRequestsCache = new Map<string, RequestsCacheEntry>());

function unauthorizedResponse() {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

async function resolveAuthenticatedUserId() {
    try {
        const session = await getServerSession(authOptions);
        const userId = String((session?.user as { id?: string } | undefined)?.id || "").trim();
        if (!session || !userId) return null;
        return userId;
    } catch (error) {
        console.error("Failed to resolve session in /api/requests", error);
        return null;
    }
}

function isNotionRateLimitedError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes("Notion API Error [429]") || message.includes("\"code\":\"rate_limited\"");
}

function invalidateRequestsCache(userIds: Array<string | undefined | null>) {
    for (const userId of userIds) {
        const normalized = String(userId || "").trim();
        if (!normalized) continue;
        requestsCache.delete(normalized);
    }
}

function sortLatestFirst<T extends { createdAt?: string }>(items: T[]) {
    return [...items].sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
    });
}

function chatKey(item: { fromId: string; toId: string }) {
    return [item.fromId, item.toId].sort().join(":");
}

function inviteKey(item: { teamId?: string; toId: string }) {
    return `${item.teamId || ""}:${item.toId}`;
}

function joinKey(item: { teamId?: string; fromId: string }) {
    return `${item.teamId || ""}:${item.fromId}`;
}

function fileKey(item: { teamId?: string; fromId: string; toId: string; fileId?: string }) {
    return `${item.teamId || ""}:${item.fileId || ""}:${item.fromId}:${item.toId}`;
}

function matchesRequest(item: RequestItem, requestId: string) {
    return item.id === requestId || item.requestId === requestId;
}

async function findAuthorizedRequestForUpdate(
    type: "CHAT" | "INVITE" | "JOIN" | "FILE",
    currentUserId: string,
    requestId: string
) {
    const allStatuses: RequestStatus[] = ["PENDING", "ACCEPTED", "DECLINED"];
    if (type === "CHAT") {
        const requests = await getChatRequestsForUserByStatuses(currentUserId, allStatuses);
        return requests.find((item) => matchesRequest(item, requestId)) || null;
    }
    if (type === "INVITE") {
        const requests = await getTeamInvitesForUserByStatuses(currentUserId, allStatuses);
        return requests.find((item) => matchesRequest(item, requestId)) || null;
    }
    if (type === "FILE") {
        const requests = await getFileShareRequestsForUserByStatuses(currentUserId, allStatuses);
        return requests.find((item) => matchesRequest(item, requestId)) || null;
    }
    const requests = await getJoinApplicationsForManagerByStatuses(currentUserId, allStatuses);
    return requests.find((item) => matchesRequest(item, requestId)) || null;
}

export async function GET() {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) return unauthorizedResponse();
    const now = Date.now();
    const cached = requestsCache.get(userId);

    if (cached && cached.expiresAt > now) {
        return NextResponse.json(cached.payload);
    }

    try {
        const allStatuses: RequestStatus[] = ["PENDING", "ACCEPTED", "DECLINED"];
        const [chatAll, invitesAll, applicationsAll, fileAll] = await Promise.all([
            getChatRequestsForUserByStatuses(userId, allStatuses),
            getTeamInvitesForUserByStatuses(userId, allStatuses),
            getJoinApplicationsForManagerByStatuses(userId, allStatuses),
            getFileShareRequestsForUserByStatuses(userId, allStatuses),
        ]);

        const pendingChat = chatAll.filter((item) => item.status === "PENDING");
        const pendingInvites = invitesAll.filter((item) => item.status === "PENDING");
        const pendingApplications = applicationsAll.filter((item) => item.status === "PENDING");
        const historyChat = chatAll.filter((item) => item.status !== "PENDING");
        const historyInvites = invitesAll.filter((item) => item.status !== "PENDING");
        const historyApplications = applicationsAll.filter((item) => item.status !== "PENDING");
        const pendingFiles = fileAll.filter((item) => item.status === "PENDING");
        const historyFiles = fileAll.filter((item) => item.status !== "PENDING");

        const acceptedChatKeys = new Set(
            historyChat.filter((item) => item.status === "ACCEPTED").map(chatKey)
        );
        const acceptedInviteKeys = new Set(
            historyInvites.filter((item) => item.status === "ACCEPTED").map(inviteKey)
        );
        const acceptedJoinKeys = new Set(
            historyApplications.filter((item) => item.status === "ACCEPTED").map(joinKey)
        );
        const acceptedFileKeys = new Set(
            historyFiles.filter((item) => item.status === "ACCEPTED").map(fileKey)
        );

        const filteredPendingChat = pendingChat.filter((item) => !acceptedChatKeys.has(chatKey(item)));
        const filteredPendingInvites = pendingInvites.filter((item) => !acceptedInviteKeys.has(inviteKey(item)));
        const filteredPendingApplications = pendingApplications.filter((item) => !acceptedJoinKeys.has(joinKey(item)));
        const filteredPendingFiles = pendingFiles.filter((item) => !acceptedFileKeys.has(fileKey(item)));

        const requests = sortLatestFirst([
            ...filteredPendingChat,
            ...filteredPendingInvites,
            ...filteredPendingApplications,
            ...filteredPendingFiles,
        ]);
        const history = sortLatestFirst([
            ...historyChat,
            ...historyInvites,
            ...historyApplications,
            ...historyFiles,
        ]);

        const payload: RequestsPayload = { requests, history };
        requestsCache.set(userId, {
            payload,
            expiresAt: now + REQUESTS_CACHE_TTL_MS,
        });

        return NextResponse.json(payload);
    } catch (error) {
        if (isNotionRateLimitedError(error)) {
            if (cached?.payload) {
                return NextResponse.json(cached.payload);
            }
            return NextResponse.json({ requests: [], history: [] });
        }
        console.error(error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) return unauthorizedResponse();

    try {
        const body = await req.json().catch(() => null);
        if (!body || typeof body !== "object") {
            return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
        }
        const { type, toId, message, answers } = body;
        let joinOwnerUserId = "";
        let targetUserId = "";
        const normalizedMessage =
            typeof message === "string"
                ? message.trim().replace(/\s+/g, " ").slice(0, 160)
                : "";

        if (type === "CHAT") {
            if (typeof toId !== "string" || !toId.trim()) {
                return NextResponse.json({ error: "toId is required for chat request." }, { status: 400 });
            }
            await createChatRequest(userId, toId, normalizedMessage || "Let's chat!");
            targetUserId = toId;
        } else if (type === "INVITE") {
            if (!body.teamId) throw new Error("Team ID required for invite");
            if (typeof toId !== "string" || !toId.trim()) {
                return NextResponse.json({ error: "toId is required for team invite." }, { status: 400 });
            }
            await createTeamInvite(
                body.teamId,
                userId,
                toId,
                normalizedMessage || "I'd like to invite you to my team."
            );
            targetUserId = toId;
        } else if (type === "JOIN") {
            const teamId =
                typeof body.teamId === "string" && body.teamId.trim()
                    ? body.teamId.trim()
                    : typeof toId === "string" && toId.trim()
                      ? toId.trim()
                      : "";
            if (!teamId) {
                return NextResponse.json({ error: "teamId is required for join request." }, { status: 400 });
            }
            const team = await getTeamById(teamId);
            if (!team) {
                return NextResponse.json({ error: "Team not found." }, { status: 404 });
            }
            joinOwnerUserId = String(team.primaryOwnerUserId || "").trim();
            const answerMessage =
                typeof answers?.a1 === "string"
                    ? answers.a1.trim().replace(/\s+/g, " ").slice(0, 160)
                    : "";
            const joinMessage = normalizedMessage || answerMessage || "I'd like to join your team.";
            await createJoinRequest(teamId, userId, joinMessage, "");
        } else if (type === "FILE") {
            const teamId =
                typeof body.teamId === "string" && body.teamId.trim().length > 0 ? body.teamId.trim() : "";
            const fileId =
                typeof body.fileId === "string" && body.fileId.trim().length > 0 ? body.fileId.trim() : "";
            const fileName =
                typeof body.fileName === "string" && body.fileName.trim().length > 0 ? body.fileName.trim() : "";
            const forceResend = Boolean((body as { forceResend?: boolean }).forceResend);
            if (!teamId) {
                return NextResponse.json({ error: "teamId is required for file share request." }, { status: 400 });
            }
            if (!fileId) {
                return NextResponse.json({ error: "fileId is required for file share request." }, { status: 400 });
            }
            if (typeof toId !== "string" || !toId.trim()) {
                return NextResponse.json({ error: "toId is required for file share request." }, { status: 400 });
            }
            await createFileShareRequest(
                teamId,
                userId,
                toId.trim(),
                fileId,
                fileName,
                normalizedMessage,
                { allowDuplicate: forceResend }
            );
            targetUserId = toId.trim();
        } else {
            return NextResponse.json({ error: "Invalid request type" }, { status: 400 });
        }

        invalidateRequestsCache([userId, targetUserId, toId, joinOwnerUserId]);
        const normalizedType = String(type || "").toUpperCase();
        const normalizedTeamId = String((body as { teamId?: string })?.teamId || "").trim();
        const requestTargetUserId =
            normalizedType === "JOIN"
                ? joinOwnerUserId
                : String(targetUserId || (typeof toId === "string" ? toId : "")).trim();
        await appendAuditLog({
            category: "request",
            event: "request_created",
            actorUserId: userId,
            targetUserId: requestTargetUserId || undefined,
            teamId:
                normalizedType === "INVITE" || normalizedType === "JOIN" || normalizedType === "FILE"
                    ? normalizedTeamId || undefined
                    : undefined,
            metadata: {
                requestType: normalizedType,
                status: "PENDING",
            },
        });

        if (normalizedType === "CHAT") {
            await appendAuditLog({
                category: "chat",
                event: "connection_requested",
                actorUserId: userId,
                targetUserId: requestTargetUserId || undefined,
                metadata: {
                    requestType: normalizedType,
                },
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof RequestConflictError) {
            const isFileDuplicate =
                error.requestType === "FILE" &&
                error.message === "An active file request already exists for this file and user.";
            if (isFileDuplicate) {
                return NextResponse.json(
                    {
                        error: "한번 보낸 파일입니다. 또 보내시겠습니까?",
                        type: error.requestType,
                        code: "FILE_ALREADY_SENT",
                    },
                    { status: 409 }
                );
            }
            return NextResponse.json(
                { error: error.message, type: error.requestType, code: "REQUEST_ALREADY_EXISTS" },
                { status: 409 }
            );
        }
        console.error(error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function PUT(req: Request) {
    const currentUserId = await resolveAuthenticatedUserId();
    if (!currentUserId) return unauthorizedResponse();

    try {
        const body = await req.json().catch(() => null);
        if (!body || typeof body !== "object") {
            return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
        }

        const { type, id, status } = body as {
            type?: "CHAT" | "INVITE" | "JOIN" | "FILE";
            id?: string;
            status?: RequestStatus;
        };
        if (!type || !id || !status) {
            return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
        }
        if (!["CHAT", "INVITE", "JOIN", "FILE"].includes(type)) {
            return NextResponse.json({ error: "Invalid request type." }, { status: 400 });
        }
        if (!["PENDING", "ACCEPTED", "DECLINED"].includes(status)) {
            return NextResponse.json({ error: "Invalid request status." }, { status: 400 });
        }

        const authorizedRequest = await findAuthorizedRequestForUpdate(type, currentUserId, id);
        if (!authorizedRequest) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const canonicalRequestId = authorizedRequest.requestId || authorizedRequest.id;
        const updated = await updateRequestStatus(type, canonicalRequestId, status);

        if (status === "ACCEPTED") {
            if (type === "INVITE" || type === "JOIN") {
                const resolvedTeamId =
                    type === "INVITE"
                        ? authorizedRequest.teamId || updated.teamId
                        : authorizedRequest.teamId || updated.teamId;
                const resolvedUserId =
                    type === "INVITE"
                        ? authorizedRequest.toId || updated.userId
                        : authorizedRequest.fromId || updated.userId;

                if (!resolvedTeamId || !resolvedUserId) {
                    await updateRequestStatus(type, canonicalRequestId, "PENDING").catch(() => undefined);
                    throw new Error("Missing team/user metadata for membership activation.");
                }

                try {
                    const { addMemberToTeam } = await import("@/lib/db/teams");
                    await addMemberToTeam(resolvedTeamId, resolvedUserId);
                    await appendAuditLog({
                        category: "team",
                        event: "team_membership_changed",
                        actorUserId: currentUserId,
                        targetUserId: resolvedUserId,
                        teamId: resolvedTeamId,
                        scope: "team",
                        metadata: {
                            reason: type === "INVITE" ? "invite_accepted" : "join_accepted",
                        },
                    });
                } catch (error) {
                    await updateRequestStatus(type, canonicalRequestId, "PENDING").catch(() => undefined);
                    throw error;
                }
            }
        }

        invalidateRequestsCache([updated.fromId, updated.toId, updated.userId, currentUserId]);
        await appendAuditLog({
            category: "request",
            event: "request_status_updated",
            actorUserId: currentUserId,
            targetUserId:
                authorizedRequest.type === "JOIN"
                    ? authorizedRequest.fromId || undefined
                    : authorizedRequest.toId || undefined,
            teamId: authorizedRequest.teamId || updated.teamId || undefined,
            metadata: {
                requestType: type,
                status,
                requestId: canonicalRequestId,
            },
        });

        if (type === "CHAT" && status === "ACCEPTED") {
            await appendAuditLog({
                category: "chat",
                event: "connection_accepted",
                actorUserId: currentUserId,
                targetUserId: authorizedRequest.fromId || authorizedRequest.toId || undefined,
                metadata: {
                    requestId: canonicalRequestId,
                },
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        );
    }
}
