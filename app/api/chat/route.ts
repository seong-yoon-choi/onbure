import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listThreadsForUser } from "@/lib/db/chat-widget";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = String((session.user as { id?: string } | undefined)?.id || "").trim();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const threads = await listThreadsForUser(userId);

        return NextResponse.json(
            threads.map((thread) => ({
                id: thread.id,
                threadId: thread.threadId || thread.id,
                type: thread.type === "team" ? "TEAM" : "DM",
                title: thread.title || "Chat",
                participantsUserIds: thread.participantsUserIds || [],
                dmSeenMap: thread.dmSeenMap || {},
                teamId: thread.teamId || null,
                lastMessageAt: thread.lastMessageAt || thread.createdAt || "",
            }))
        );
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
