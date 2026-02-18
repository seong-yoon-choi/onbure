import { NextResponse } from "next/server";
import { getPublicTeams, getTeamMembershipsForUser } from "@/lib/db/teams";
import { listUsers } from "@/lib/db/users";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getActiveChatPartnerStates, getJoinRequestsForApplicantByStatuses } from "@/lib/db/requests";

interface DiscoveryTeamRow {
    id: string;
    teamId: string;
    name: string;
    description: string;
    visibility: string;
    stage?: string;
    language?: string;
    recruitingRoles: string[];
    isJoined: boolean;
    isJoinRequested: boolean;
    isOwner: boolean;
}

interface DiscoveryPersonRow {
    id: string;
    userId: string;
    username: string;
    publicCode: string;
    country: string;
    language: string;
    skills: string[];
    availabilityHours: string;
    bio: string;
    chatState: "NONE" | "PENDING" | "ACCEPTED";
    canRequestChat: boolean;
}

interface DiscoveryPayload {
    teams: DiscoveryTeamRow[];
    people: DiscoveryPersonRow[];
    partialError: boolean;
}

interface DiscoveryCacheEntry {
    expiresAt: number;
    payload: DiscoveryPayload;
}

const DISCOVERY_CACHE_TTL_MS = 12_000;

declare global {
    var __onbureDiscoveryCache: Map<string, DiscoveryCacheEntry> | undefined;
}

const discoveryCache =
    globalThis.__onbureDiscoveryCache ||
    (globalThis.__onbureDiscoveryCache = new Map<string, DiscoveryCacheEntry>());

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = String((session.user as { id?: string } | undefined)?.id || "").trim();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const now = Date.now();
    const cached = discoveryCache.get(userId);
    if (cached && cached.expiresAt > now) {
        return NextResponse.json(cached.payload);
    }

    const [teamsResult, usersResult, activeChatStatesResult, membershipsResult, joinRequestsResult] =
        await Promise.allSettled([
            getPublicTeams(),
            listUsers(),
            getActiveChatPartnerStates(userId),
            getTeamMembershipsForUser(userId),
            getJoinRequestsForApplicantByStatuses(userId, ["PENDING", "ACCEPTED"]),
        ]);

    const isRejected = (result: PromiseSettledResult<unknown>) => result.status === "rejected";
    const hadPartialError =
        isRejected(teamsResult) ||
        isRejected(usersResult) ||
        isRejected(activeChatStatesResult) ||
        isRejected(membershipsResult) ||
        isRejected(joinRequestsResult);

    if (hadPartialError) {
        console.error("GET /api/discovery partially failed", {
            teamsError: teamsResult.status === "rejected" ? String(teamsResult.reason) : undefined,
            usersError: usersResult.status === "rejected" ? String(usersResult.reason) : undefined,
            chatStatesError:
                activeChatStatesResult.status === "rejected"
                    ? String(activeChatStatesResult.reason)
                    : undefined,
            membershipsError:
                membershipsResult.status === "rejected" ? String(membershipsResult.reason) : undefined,
            joinRequestsError:
                joinRequestsResult.status === "rejected" ? String(joinRequestsResult.reason) : undefined,
        });
    }

    const teams = teamsResult.status === "fulfilled" ? teamsResult.value : [];
    const users = usersResult.status === "fulfilled" ? usersResult.value : [];
    const activeChatStates = activeChatStatesResult.status === "fulfilled" ? activeChatStatesResult.value : {};
    const memberships = membershipsResult.status === "fulfilled" ? membershipsResult.value : [];
    const myJoinRequests = joinRequestsResult.status === "fulfilled" ? joinRequestsResult.value : [];

    const myTeamIds = new Set(memberships.map((membership) => membership.teamId));
    const myRequestedTeamIds = new Set(
        myJoinRequests
            .map((item) => item.teamId)
            .filter((teamId): teamId is string => Boolean(teamId))
    );
    const teamsWithJoinState: DiscoveryTeamRow[] = teams.map((team) => ({
        id: String(team.teamId || team.id || ""),
        teamId: String(team.teamId || ""),
        name: String(team.name || ""),
        description: String(team.description || ""),
        visibility: String(team.visibility || "Private"),
        stage: team.stage || "",
        language: team.language || "",
        recruitingRoles: Array.isArray(team.recruitingRoles) ? team.recruitingRoles : [],
        isJoined: myTeamIds.has(team.teamId),
        isJoinRequested: !myTeamIds.has(team.teamId) && myRequestedTeamIds.has(team.teamId),
        isOwner: team.primaryOwnerUserId === userId,
    }));

    const others: DiscoveryPersonRow[] = users
        .filter((u) => u.userId !== userId)
        .map((u) => {
            const state = activeChatStates[u.userId];
            return {
                id: String(u.userId || u.id || ""),
                userId: String(u.userId || ""),
                username: String(u.username || "Unknown"),
                publicCode: String(u.publicCode || ""),
                country: String(u.country || ""),
                language: String(u.language || ""),
                skills: Array.isArray(u.skills) ? u.skills : [],
                availabilityHours: String(u.availabilityHours || ""),
                bio: String(u.bio || ""),
                chatState: (state ?? "NONE") as "NONE" | "PENDING" | "ACCEPTED",
                canRequestChat: !state,
            };
        });

    const payload: DiscoveryPayload = {
        teams: teamsWithJoinState,
        people: others,
        partialError: hadPartialError,
    };

    if (!hadPartialError || !cached) {
        discoveryCache.set(userId, {
            payload,
            expiresAt: now + DISCOVERY_CACHE_TTL_MS,
        });
    }

    if (hadPartialError && cached?.payload) {
        return NextResponse.json({
            ...cached.payload,
            partialError: true,
        });
    }

    return NextResponse.json(payload);
}
