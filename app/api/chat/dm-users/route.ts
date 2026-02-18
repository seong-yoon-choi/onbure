import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listDmUsersForChat } from "@/lib/db/chat-widget";

interface DmUsersCacheEntry {
    expiresAt: number;
    data: unknown[];
}

const DM_USERS_CACHE_TTL_MS = 15_000;

declare global {
    var __onbureChatDmUsersCache: Map<string, DmUsersCacheEntry> | undefined;
}

const dmUsersCache =
    globalThis.__onbureChatDmUsersCache ||
    (globalThis.__onbureChatDmUsersCache = new Map<string, DmUsersCacheEntry>());

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = String((session.user as { id?: string } | undefined)?.id || "").trim();
    if (!currentUserId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const now = Date.now();
    const cached = dmUsersCache.get(currentUserId);

    if (cached && cached.expiresAt > now) {
        return NextResponse.json(cached.data);
    }

    try {
        const users = await listDmUsersForChat(currentUserId);
        dmUsersCache.set(currentUserId, {
            data: users,
            expiresAt: now + DM_USERS_CACHE_TTL_MS,
        });
        return NextResponse.json(users);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isRateLimited = message.includes("Notion API Error [429]");

        if (isRateLimited && cached?.data) {
            return NextResponse.json(cached.data);
        }

        if (isRateLimited) {
            return NextResponse.json([]);
        }

        console.error("GET /api/chat/dm-users failed", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
