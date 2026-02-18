import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type ChatWidgetDbModule = typeof import("@/lib/db/chat-widget");
type AuditDbModule = typeof import("@/lib/db/audit");

let chatWidgetDbPromise: Promise<ChatWidgetDbModule> | null = null;
let auditDbPromise: Promise<AuditDbModule> | null = null;

function loadChatWidgetDb() {
    if (!chatWidgetDbPromise) {
        chatWidgetDbPromise = import("@/lib/db/chat-widget");
    }
    return chatWidgetDbPromise;
}

function loadAuditDb() {
    if (!auditDbPromise) {
        auditDbPromise = import("@/lib/db/audit");
    }
    return auditDbPromise;
}

async function resolveAuthenticatedUserId() {
    try {
        const session = await getServerSession(authOptions);
        const userId = String((session?.user as { id?: string } | undefined)?.id || "").trim();
        if (!session || !userId) return null;
        return userId;
    } catch (error) {
        console.error("Failed to resolve session in /api/chat/messages", error);
        return null;
    }
}

function parseDmParticipants(threadId: string) {
    const normalized = String(threadId || "").trim();
    if (!normalized.toLowerCase().startsWith("dm::")) return [];
    return Array.from(
        new Set(
            normalized
                .split("::")
                .slice(1)
                .map((value) => value.trim())
                .filter(Boolean)
        )
    );
}

function parseTeamId(threadId: string) {
    const normalized = String(threadId || "").trim();
    if (!normalized.toLowerCase().startsWith("team::")) return "";
    return normalized.split("::").slice(1).join("::").trim();
}

function invalidateChatAlertsCache(userIds: Array<string | undefined | null>) {
    const cache = (globalThis as { __onbureChatAlertsCache?: Map<string, unknown> }).__onbureChatAlertsCache;
    if (!cache) return;
    for (const userId of userIds) {
        const normalized = String(userId || "").trim();
        if (!normalized) continue;
        cache.delete(normalized);
    }
}

function hasSessionCookie(req: NextRequest): boolean {
    const cookieHeader = String(req.headers.get("cookie") || "");
    if (!cookieHeader) return false;

    return (
        cookieHeader.includes("next-auth.session-token=") ||
        cookieHeader.includes("__Secure-next-auth.session-token=") ||
        cookieHeader.includes("authjs.session-token=") ||
        cookieHeader.includes("__Secure-authjs.session-token=")
    );
}

export async function GET(req: NextRequest) {
    if (!hasSessionCookie(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const currentUserId = await resolveAuthenticatedUserId();
    if (!currentUserId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const chatWidgetDb = await loadChatWidgetDb();
        const threadId = req.nextUrl.searchParams.get("threadId");
        if (!threadId) {
            return NextResponse.json({ error: "threadId is required." }, { status: 400 });
        }

        const messages = await chatWidgetDb.listMessagesForThread(threadId, currentUserId);
        invalidateChatAlertsCache([currentUserId]);
        return NextResponse.json(messages);
    } catch (error: any) {
        if (error?.message === "Forbidden") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (error?.message === "Thread not found.") {
            return NextResponse.json({ error: "Thread not found." }, { status: 404 });
        }
        console.error("GET /api/chat/messages failed", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    if (!hasSessionCookie(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const senderUserId = await resolveAuthenticatedUserId();
    if (!senderUserId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const chatWidgetDb = await loadChatWidgetDb();
        const auditDb = await loadAuditDb();
        const body = await req.json().catch(() => null);
        if (!body || typeof body !== "object") {
            return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
        }

        const { threadId, body_original } = body as { threadId?: string; body_original?: string };
        if (!threadId || typeof threadId !== "string") {
            return NextResponse.json({ error: "threadId is required." }, { status: 400 });
        }
        if (!body_original || typeof body_original !== "string") {
            return NextResponse.json({ error: "body_original is required." }, { status: 400 });
        }

        const message = await chatWidgetDb.createMessageForThread(threadId, senderUserId, body_original);
        const teamId = parseTeamId(threadId);
        const dmParticipants = parseDmParticipants(threadId);
        const dmTargets = dmParticipants.filter((userId) => userId !== senderUserId);

        if (teamId) {
            await auditDb.appendAuditLog({
                category: "chat",
                event: "message_created",
                actorUserId: senderUserId,
                teamId,
                scope: "team",
                metadata: { threadId },
            });
        } else if (dmTargets.length) {
            await Promise.all(
                dmTargets.map((targetUserId) =>
                    auditDb.appendAuditLog({
                        category: "chat",
                        event: "message_created",
                        actorUserId: senderUserId,
                        targetUserId,
                        scope: "user",
                        metadata: { threadId },
                    })
                )
            );
            invalidateChatAlertsCache([senderUserId, ...dmTargets]);
        } else {
            await auditDb.appendAuditLog({
                category: "chat",
                event: "message_created",
                actorUserId: senderUserId,
                metadata: { threadId },
            });
        }
        if (!dmTargets.length) {
            invalidateChatAlertsCache([senderUserId]);
        }
        return NextResponse.json(message);
    } catch (error: any) {
        if (error?.message === "Forbidden") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (error?.message === "Thread not found.") {
            return NextResponse.json({ error: "Thread not found." }, { status: 404 });
        }
        console.error("POST /api/chat/messages failed", error);
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}
