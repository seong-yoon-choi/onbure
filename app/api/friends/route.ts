import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAcceptedFriendPartnerIds } from "@/lib/db/requests";
import { listUsersByUserIds } from "@/lib/db/users";

export const runtime = "nodejs";

interface FriendCacheEntry {
    expiresAt: number;
    payload: unknown[];
}

const FRIENDS_CACHE_TTL_MS = 15_000;

declare global {
    var __onbureFriendsCache: Map<string, FriendCacheEntry> | undefined;
}

const friendsCache =
    globalThis.__onbureFriendsCache ||
    (globalThis.__onbureFriendsCache = new Map<string, FriendCacheEntry>());

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
    const cached = friendsCache.get(currentUserId);
    if (cached && cached.expiresAt > now) {
        return NextResponse.json(cached.payload);
    }

    try {
        const partnerIds = await getAcceptedFriendPartnerIds(currentUserId);
        if (!partnerIds.length) {
            const empty: unknown[] = [];
            friendsCache.set(currentUserId, { payload: empty, expiresAt: now + FRIENDS_CACHE_TTL_MS });
            return NextResponse.json(empty);
        }

        const users = await listUsersByUserIds(partnerIds);
        const payload = users
            .map((user) => ({
                userId: user.userId,
                username: user.username || "Unknown",
                language: user.language || "",
                country: user.country || "",
                skills: user.skills || [],
            }))
            .sort((a, b) => a.username.localeCompare(b.username));

        friendsCache.set(currentUserId, {
            payload,
            expiresAt: now + FRIENDS_CACHE_TTL_MS,
        });
        return NextResponse.json(payload);
    } catch (error) {
        console.error("GET /api/friends failed", error);
        if (cached?.payload) return NextResponse.json(cached.payload);
        return NextResponse.json([], { status: 200 });
    }
}
