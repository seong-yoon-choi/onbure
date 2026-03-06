import { NextResponse } from "next/server";
import { getPublicTeams, getTeamMembershipsForUser } from "@/lib/db/teams";
import { listUsers } from "@/lib/db/users";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
    getActiveChatPartnerStates,
    getActiveFriendPartnerStates,
    getJoinRequestsForApplicantByStatuses,
} from "@/lib/db/requests";
import { translateTextsWithDeepL } from "@/lib/server/deepl";

interface DiscoveryTeamRow {
    id: string;
    teamId: string;
    name: string;
    description: string;
    descriptionTranslated?: string;
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
    friendState: "NONE" | "PENDING" | "ACCEPTED";
    canRequestFriend: boolean;
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
    const userId = String((session?.user as { id?: string } | undefined)?.id || "").trim();
    const now = Date.now();
    const cached = discoveryCache.get(userId);
    if (cached && cached.expiresAt > now) {
        return NextResponse.json(cached.payload);
    }

    const [teamsResult, usersResult, activeChatStatesResult, activeFriendStatesResult, membershipsResult, joinRequestsResult] =
        await Promise.allSettled([
            getPublicTeams(),
            listUsers(),
            userId ? getActiveChatPartnerStates(userId) : Promise.resolve({} as Record<string, any>),
            userId ? getActiveFriendPartnerStates(userId) : Promise.resolve({} as Record<string, any>),
            userId ? getTeamMembershipsForUser(userId) : Promise.resolve([]),
            userId ? getJoinRequestsForApplicantByStatuses(userId, ["PENDING"]) : Promise.resolve([]),
        ]);

    const isRejected = (result: PromiseSettledResult<unknown>) => result.status === "rejected";
    const hadPartialError =
        isRejected(teamsResult) ||
        isRejected(usersResult) ||
        isRejected(activeChatStatesResult) ||
        isRejected(activeFriendStatesResult) ||
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
            friendStatesError:
                activeFriendStatesResult.status === "rejected"
                    ? String(activeFriendStatesResult.reason)
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
    const activeFriendStates = activeFriendStatesResult.status === "fulfilled" ? activeFriendStatesResult.value : {};
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
    let localizedTeams = teamsWithJoinState;
    if (userId) {
        const viewerLanguage =
            users.find((user) => String(user.userId || "").trim() === userId)?.language || "";
        if (viewerLanguage) {
            const descriptionsToTranslate = teamsWithJoinState
                .map((team) => String(team.description || "").trim())
                .filter(Boolean);
            const translatedByOriginal = await translateTextsWithDeepL(
                descriptionsToTranslate,
                viewerLanguage
            );
            localizedTeams = teamsWithJoinState.map((team) => {
                const originalDescription = String(team.description || "").trim();
                const translatedDescription = originalDescription
                    ? String(translatedByOriginal.get(originalDescription) || "").trim()
                    : "";
                if (!translatedDescription || translatedDescription === originalDescription) {
                    return team;
                }
                return {
                    ...team,
                    descriptionTranslated: translatedDescription,
                };
            });
        }
    }

    const others: DiscoveryPersonRow[] = users
        .filter((u) => u.userId !== userId)
        .map((u) => {
            const chatState = activeChatStates[u.userId];
            const friendState = activeFriendStates[u.userId];
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
                chatState: (chatState ?? "NONE") as "NONE" | "PENDING" | "ACCEPTED",
                canRequestChat: !chatState,
                friendState: (friendState ?? "NONE") as "NONE" | "PENDING" | "ACCEPTED",
                canRequestFriend: !friendState,
            };
        });

    const payload: DiscoveryPayload = {
        teams: localizedTeams,
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
