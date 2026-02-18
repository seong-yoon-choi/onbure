import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateDmThread, listThreadsForUser } from "@/lib/db/chat-widget";
import { getAcceptedChatPartnerIds } from "@/lib/db/requests";

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
        const { otherUserId } = body as { otherUserId?: string };
        if (!otherUserId || typeof otherUserId !== "string") {
            return NextResponse.json({ error: "otherUserId is required." }, { status: 400 });
        }

        const currentUserId = String((session.user as { id?: string } | undefined)?.id || "").trim();
        if (!currentUserId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (currentUserId === otherUserId) {
            return NextResponse.json({ error: "Invalid DM target user." }, { status: 400 });
        }

        const acceptedPartners = new Set(await getAcceptedChatPartnerIds(currentUserId));
        if (!acceptedPartners.has(otherUserId)) {
            const threads = await listThreadsForUser(currentUserId);
            const hasExistingThread = threads.some(
                (thread) =>
                    thread.type === "dm" &&
                    thread.participantsUserIds.includes(currentUserId) &&
                    thread.participantsUserIds.includes(otherUserId)
            );
            if (!hasExistingThread) {
                return NextResponse.json({ error: "Chat request is not accepted yet." }, { status: 403 });
            }
        }

        const thread = await getOrCreateDmThread(currentUserId, otherUserId);
        return NextResponse.json(thread);
    } catch (error: any) {
        console.error("POST /api/chat/thread/dm failed", error);
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}
