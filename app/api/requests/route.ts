import { NextResponse } from "next/server";
import type { RequestItem, RequestStatus } from "@/lib/db/requests";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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

type RequestsDbModule = typeof import("@/lib/db/requests");
type TeamsDbModule = typeof import("@/lib/db/teams");
type AuditDbModule = typeof import("@/lib/db/audit");

let requestsDbModulePromise: Promise<RequestsDbModule> | null = null;
let teamsDbModulePromise: Promise<TeamsDbModule> | null = null;
let auditDbModulePromise: Promise<AuditDbModule> | null = null;

function loadRequestsDb() {
    if (!requestsDbModulePromise) {
        requestsDbModulePromise = import("@/lib/db/requests");
    }
    return requestsDbModulePromise;
}

function loadTeamsDb() {
    if (!teamsDbModulePromise) {
        teamsDbModulePromise = import("@/lib/db/teams");
    }
    return teamsDbModulePromise;
}

function loadAuditDb() {
    if (!auditDbModulePromise) {
        auditDbModulePromise = import("@/lib/db/audit");
    }
    return auditDbModulePromise;
}

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

function parseRequestConflictError(error: unknown): { requestType: "CHAT" | "INVITE" | "JOIN" | "FILE"; message: string } | null {
    if (!error || typeof error !== "object") return null;

    const candidate = error as {
        name?: string;
        requestType?: unknown;
        message?: unknown;
    };
    if (candidate.name !== "RequestConflictError") return null;

    const requestType = String(candidate.requestType || "").toUpperCase();
    if (!["CHAT", "INVITE", "JOIN", "FILE"].includes(requestType)) return null;

    return {
        requestType: requestType as "CHAT" | "INVITE" | "JOIN" | "FILE",
        message: typeof candidate.message === "string" ? candidate.message : "",
    };
}

async function findAuthorizedRequestForUpdate(
    requestsDb: RequestsDbModule,
    type: "CHAT" | "INVITE" | "JOIN" | "FILE",
    currentUserId: string,
    requestId: string
) {
    const allStatuses: RequestStatus[] = ["PENDING", "ACCEPTED", "DECLINED"];
    if (type === "CHAT") {
        const requests = await requestsDb.getChatRequestsForUserByStatuses(currentUserId, allStatuses);
        return requests.find((item) => matchesRequest(item, requestId)) || null;
    }
    if (type === "INVITE") {
        const requests = await requestsDb.getTeamInvitesForUserByStatuses(currentUserId, allStatuses);
        return requests.find((item) => matchesRequest(item, requestId)) || null;
    }
    if (type === "FILE") {
        const requests = await requestsDb.getFileShareRequestsForUserByStatuses(currentUserId, allStatuses);
        return requests.find((item) => matchesRequest(item, requestId)) || null;
    }
    const requests = await requestsDb.getJoinApplicationsForManagerByStatuses(currentUserId, allStatuses);
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
        const requestsDb = await loadRequestsDb();
        const allStatuses: RequestStatus[] = ["PENDING", "ACCEPTED", "DECLINED"];
        const [chatAll, invitesAll, applicationsAll, fileAll] = await Promise.all([
            requestsDb.getChatRequestsForUserByStatuses(userId, allStatuses),
            requestsDb.getTeamInvitesForUserByStatuses(userId, allStatuses),
            requestsDb.getJoinApplicationsForManagerByStatuses(userId, allStatuses),
            requestsDb.getFileShareRequestsForUserByStatuses(userId, allStatuses),
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
        const requestsDb = await loadRequestsDb();
        const auditDb = await loadAuditDb();
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
            await requestsDb.createChatRequest(userId, toId, normalizedMessage || "Let's chat!");
            targetUserId = toId;
        } else if (type === "INVITE") {
            if (!body.teamId) throw new Error("Team ID required for invite");
            if (typeof toId !== "string" || !toId.trim()) {
                return NextResponse.json({ error: "toId is required for team invite." }, { status: 400 });
            }
            await requestsDb.createTeamInvite(
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
            const teamsDb = await loadTeamsDb();
            const team = await teamsDb.getTeamById(teamId);
            if (!team) {
                return NextResponse.json({ error: "Team not found." }, { status: 404 });
            }
            joinOwnerUserId = String(team.primaryOwnerUserId || "").trim();
            const answerMessage =
                typeof answers?.a1 === "string"
                    ? answers.a1.trim().replace(/\s+/g, " ").slice(0, 160)
                    : "";
            const joinMessage = normalizedMessage || answerMessage || "I'd like to join your team.";
            await requestsDb.createJoinRequest(teamId, userId, joinMessage, "");
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
            await requestsDb.createFileShareRequest(
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
        await auditDb.appendAuditLog({
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
            await auditDb.appendAuditLog({
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
        const conflict = parseRequestConflictError(error);
        if (conflict) {
            const isFileDuplicate =
                conflict.requestType === "FILE" &&
                conflict.message === "An active file request already exists for this file and user.";
            if (isFileDuplicate) {
                return NextResponse.json(
                    {
                        error: "This file was already sent. Send again?",
                        type: conflict.requestType,
                        code: "FILE_ALREADY_SENT",
                    },
                    { status: 409 }
                );
            }
            return NextResponse.json(
                { error: conflict.message, type: conflict.requestType, code: "REQUEST_ALREADY_EXISTS" },
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
        const requestsDb = await loadRequestsDb();
        const auditDb = await loadAuditDb();
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

        const authorizedRequest = await findAuthorizedRequestForUpdate(requestsDb, type, currentUserId, id);
        if (!authorizedRequest) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const canonicalRequestId = authorizedRequest.requestId || authorizedRequest.id;
        const updated = await requestsDb.updateRequestStatus(type, canonicalRequestId, status);

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
                    await requestsDb.updateRequestStatus(type, canonicalRequestId, "PENDING").catch(() => undefined);
                    throw new Error("Missing team/user metadata for membership activation.");
                }

                try {
                    const { addMemberToTeam } = await import("@/lib/db/teams");
                    await addMemberToTeam(resolvedTeamId, resolvedUserId);
                    await auditDb.appendAuditLog({
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
                    await requestsDb.updateRequestStatus(type, canonicalRequestId, "PENDING").catch(() => undefined);
                    throw error;
                }
            }
        }

        invalidateRequestsCache([updated.fromId, updated.toId, updated.userId, currentUserId]);
        await auditDb.appendAuditLog({
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
            await auditDb.appendAuditLog({
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

