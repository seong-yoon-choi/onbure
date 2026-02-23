import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { removeFriendship } from "@/lib/db/requests";

export const runtime = "nodejs";

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ friendId: string }> | { friendId: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = String((session.user as { id?: string } | undefined)?.id || "").trim();
    if (!currentUserId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Support Next.js 15+ dynamic params
    const resolvedParams = await Promise.resolve(params);
    const targetUserId = resolvedParams.friendId;

    if (!targetUserId) {
        return NextResponse.json({ error: "Friend ID is required" }, { status: 400 });
    }

    if (currentUserId === targetUserId) {
        return NextResponse.json({ error: "Cannot unfriend yourself" }, { status: 400 });
    }

    try {
        await removeFriendship(currentUserId, targetUserId);

        // Clear the cache manually since it was modified
        if (globalThis.__onbureFriendsCache) {
            globalThis.__onbureFriendsCache.delete(currentUserId);
            globalThis.__onbureFriendsCache.delete(targetUserId);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("DELETE /api/friends/[friendId] failed", error);
        return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
    }
}
