import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listTeamsForChat } from "@/lib/db/chat-widget";

interface TeamCacheEntry {
    expiresAt: number;
    data: unknown[];
}

const TEAM_CACHE_TTL_MS = 15_000;

declare global {
    var __onbureChatTeamsCache: Map<string, TeamCacheEntry> | undefined;
}

const teamCache =
    globalThis.__onbureChatTeamsCache ||
    (globalThis.__onbureChatTeamsCache = new Map<string, TeamCacheEntry>());

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
    const cached = teamCache.get(currentUserId);

    if (cached && cached.expiresAt > now) {
        return NextResponse.json(cached.data);
    }

    try {
        const teams = await listTeamsForChat(currentUserId);
        teamCache.set(currentUserId, {
            data: teams,
            expiresAt: now + TEAM_CACHE_TTL_MS,
        });
        return NextResponse.json(teams);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isRateLimited = message.includes("Notion API Error [429]");

        if (isRateLimited && cached?.data) {
            return NextResponse.json(cached.data);
        }

        if (isRateLimited) {
            return NextResponse.json([]);
        }

        console.error("GET /api/chat/teams failed", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
