import { NextResponse } from "next/server";
import { getPublicTeams, getTeamMembershipsForUser } from "@/lib/db/teams";
import { listUsers } from "@/lib/db/users";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getActiveChatPartnerStates, getJoinRequestsForApplicantByStatuses } from "@/lib/db/requests";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any).id;

    try {
        const [teams, users, activeChatStates, memberships, myJoinRequests] = await Promise.all([
            getPublicTeams(),
            listUsers(),
            getActiveChatPartnerStates(userId),
            getTeamMembershipsForUser(userId),
            getJoinRequestsForApplicantByStatuses(userId, ["PENDING", "ACCEPTED"]),
        ]);
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

        // Filter out myself from people list
        const others = users
            .filter((u) => u.userId !== userId)
            .map((u) => {
                const state = activeChatStates[u.userId];
                return {
                    ...u,
                    chatState: state ?? "NONE",
                    canRequestChat: !state
                };
            });

        return NextResponse.json({ teams: teamsWithJoinState, people: others });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
