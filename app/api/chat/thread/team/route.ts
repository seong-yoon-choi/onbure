import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateTeamThread, listTeamsForChat } from "@/lib/db/chat-widget";

interface TeamMembershipCacheEntry {
    expiresAt: number;
    teamIds: Set<string>;
}

const TEAM_MEMBERSHIP_CACHE_TTL_MS = 20_000;

declare global {
    var __onbureTeamMembershipCache: Map<string, TeamMembershipCacheEntry> | undefined;
}

const teamMembershipCache =
    globalThis.__onbureTeamMembershipCache ||
    (globalThis.__onbureTeamMembershipCache = new Map<string, TeamMembershipCacheEntry>());

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { teamId } = await req.json();
        if (!teamId || typeof teamId !== "string") {
            return NextResponse.json({ error: "teamId is required." }, { status: 400 });
        }

        const currentUserId = String((session.user as { id?: string } | undefined)?.id || "").trim();
        if (!currentUserId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const now = Date.now();
        let membership = teamMembershipCache.get(currentUserId);
        if (!membership || membership.expiresAt <= now) {
            const myTeams = await listTeamsForChat(currentUserId);
            membership = {
                expiresAt: now + TEAM_MEMBERSHIP_CACHE_TTL_MS,
                teamIds: new Set(myTeams.map((team) => team.teamId)),
            };
            teamMembershipCache.set(currentUserId, membership);
        }

        const isMember = membership.teamIds.has(teamId);
        if (!isMember) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const thread = await getOrCreateTeamThread(teamId);
        return NextResponse.json(thread);
    } catch (error: any) {
        console.error("POST /api/chat/thread/team failed", error);
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}
