import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createMessageForThread, listMessagesForThread } from "@/lib/db/chat-widget";
import { appendAuditLog } from "@/lib/db/audit";

function parseTeamId(threadId: string) {
    const normalized = String(threadId || "").trim();
    if (!normalized.toLowerCase().startsWith("team::")) return "";
    return normalized.split("::").slice(1).join("::").trim();
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

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const currentUserId = String((session.user as { id?: string } | undefined)?.id || "").trim();
    if (!currentUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const messages = await listMessagesForThread(id, currentUserId);
        return NextResponse.json(messages);
    } catch (error: any) {
        if (error?.message === "Forbidden") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (error?.message === "Thread not found.") {
            return NextResponse.json({ error: "Thread not found." }, { status: 404 });
        }
        console.error(error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json().catch(() => null);
        if (!body || typeof body !== "object") {
            return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
        }
        const { content, body_original } = body as { content?: string; body_original?: string };
        const { id } = await params;
        const threadId = id;
        const senderId = String((session.user as { id?: string } | undefined)?.id || "").trim();
        if (!senderId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const nextContent =
            typeof body_original === "string" && body_original.trim()
                ? body_original
                : typeof content === "string"
                  ? content
                  : "";
        if (!nextContent.trim()) {
            return NextResponse.json({ error: "content is required." }, { status: 400 });
        }

        const result = await createMessageForThread(threadId, senderId, nextContent);
        const teamId = parseTeamId(threadId);
        const dmParticipants = parseDmParticipants(threadId).filter((userId) => userId !== senderId);
        if (teamId) {
            await appendAuditLog({
                category: "chat",
                event: "message_created",
                actorUserId: senderId,
                teamId,
                scope: "team",
                metadata: { threadId },
            });
        } else if (dmParticipants.length) {
            await Promise.all(
                dmParticipants.map((targetUserId) =>
                    appendAuditLog({
                        category: "chat",
                        event: "message_created",
                        actorUserId: senderId,
                        targetUserId,
                        scope: "user",
                        metadata: { threadId },
                    })
                )
            );
        }
        return NextResponse.json(result);
    } catch (error: any) {
        if (error?.message === "Forbidden") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (error?.message === "Thread not found.") {
            return NextResponse.json({ error: "Thread not found." }, { status: 404 });
        }
        console.error(error);
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}
