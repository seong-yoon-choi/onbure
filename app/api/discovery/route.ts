import { NextResponse } from "next/server";
import { getPublicTeams, getTeamMembershipsForUser } from "@/lib/db/teams";
import { listUsers } from "@/lib/db/users";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getActiveChatPartnerStates, getJoinRequestsForApplicantByStatuses } from "@/lib/db/requests";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = String((session.user as { id?: string } | undefined)?.id || "").trim();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    const teamsWithJoinState = teams.map((team) => ({
        ...team,
        isJoined: myTeamIds.has(team.teamId),
        isJoinRequested: !myTeamIds.has(team.teamId) && myRequestedTeamIds.has(team.teamId),
        isOwner: team.primaryOwnerUserId === userId,
    }));

    const others = users
        .filter((u) => u.userId !== userId)
        .map((u) => {
            const state = activeChatStates[u.userId];
            return {
                ...u,
                chatState: state ?? "NONE",
                canRequestChat: !state,
            };
        });

    return NextResponse.json({
        teams: teamsWithJoinState,
        people: others,
        partialError: hadPartialError,
    });
}
