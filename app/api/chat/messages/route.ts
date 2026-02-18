import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createMessageForThread, listMessagesForThread } from "@/lib/db/chat-widget";
import { appendAuditLog } from "@/lib/db/audit";

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

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const threadId = req.nextUrl.searchParams.get("threadId");
        if (!threadId) {
            return NextResponse.json({ error: "threadId is required." }, { status: 400 });
        }

        const currentUserId = String((session.user as { id?: string } | undefined)?.id || "").trim();
        if (!currentUserId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const messages = await listMessagesForThread(threadId, currentUserId);
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
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
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

        const senderUserId = String((session.user as { id?: string } | undefined)?.id || "").trim();
        if (!senderUserId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const message = await createMessageForThread(threadId, senderUserId, body_original);
        const teamId = parseTeamId(threadId);
        const dmParticipants = parseDmParticipants(threadId);
        const dmTargets = dmParticipants.filter((userId) => userId !== senderUserId);

        if (teamId) {
            await appendAuditLog({
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
                    appendAuditLog({
                        category: "chat",
                        event: "message_created",
                        actorUserId: senderUserId,
                        targetUserId,
                        scope: "user",
                        metadata: { threadId },
                    })
                )
            );
        } else {
            await appendAuditLog({
                category: "chat",
                event: "message_created",
                actorUserId: senderUserId,
                metadata: { threadId },
            });
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
