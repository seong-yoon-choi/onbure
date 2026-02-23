import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { appendAuditLog } from "@/lib/db/audit";
import { getTeamById, getTeamMembers, isActiveMemberStatus, leaveTeam } from "@/lib/db/teams";
import { verifyUserPassword } from "@/lib/db/users";

export const runtime = "nodejs";

function invalidateTeamDetailCache(teamId: string) {
    const detailCache = (globalThis as { __onbureTeamDetailCache?: Map<string, unknown> }).__onbureTeamDetailCache;
    const detailSyncCache = (globalThis as { __onbureTeamDetailSyncCache?: Map<string, unknown> }).__onbureTeamDetailSyncCache;
    if (detailCache) {
        const suffix = `:${teamId}`;
        for (const key of detailCache.keys()) {
            if (key.endsWith(suffix)) detailCache.delete(key);
        }
    }
    if (detailSyncCache) {
        const suffix = `:${teamId}`;
        for (const key of detailSyncCache.keys()) {
            if (key.endsWith(suffix)) detailSyncCache.delete(key);
        }
    }
}

function invalidateWorkspaceTeamCache(teamId: string) {
    const workspaceCache = (globalThis as { __onbureWorkspaceCache?: Map<string, unknown> }).__onbureWorkspaceCache;
    const workspaceSyncCache = (globalThis as { __onbureWorkspaceSyncCache?: Map<string, unknown> }).__onbureWorkspaceSyncCache;
    const workspacePresence = (globalThis as { __onbureWorkspacePresence?: Map<string, unknown> }).__onbureWorkspacePresence;
    const suffix = `:${teamId}`;
    if (workspaceCache) {
        for (const key of workspaceCache.keys()) {
            if (key.endsWith(suffix)) workspaceCache.delete(key);
        }
    }
    if (workspaceSyncCache) {
        for (const key of workspaceSyncCache.keys()) {
            if (key.endsWith(suffix)) workspaceSyncCache.delete(key);
        }
    }
    if (workspacePresence) {
        for (const key of workspacePresence.keys()) {
            if (key.startsWith(`${teamId}:`)) workspacePresence.delete(key);
        }
    }
}

export async function POST(
    req: Request,
    { params }: { params: Promise<{ teamId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = String((session.user as { id?: string } | undefined)?.id || "").trim();
    if (!currentUserId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;
    const normalizedTeamId = String(teamId || "").trim();
    if (!normalizedTeamId) {
        return NextResponse.json({ error: "teamId is required." }, { status: 400 });
    }

    try {
        const body = await req.json().catch(() => ({} as { password?: string }));
        const password = typeof body?.password === "string" ? body.password : "";
        if (!password) {
            return NextResponse.json({ error: "Password is required." }, { status: 400 });
        }
        const isValidPassword = await verifyUserPassword(currentUserId, password);
        if (!isValidPassword) {
            return NextResponse.json({ error: "Invalid password." }, { status: 403 });
        }

        const team = await getTeamById(normalizedTeamId);
        if (!team) {
            return NextResponse.json({ error: "Team not found." }, { status: 404 });
        }
        if (team.primaryOwnerUserId === currentUserId) {
            return NextResponse.json({ error: "Owner cannot leave the team." }, { status: 403 });
        }

        const members = await getTeamMembers(normalizedTeamId);
        const me = members.find(
            (member) => member.userId === currentUserId && isActiveMemberStatus(member.status)
        );
        if (!me) {
            return NextResponse.json({ error: "Only active members can leave this team." }, { status: 403 });
        }

        await leaveTeam(normalizedTeamId, currentUserId);
        invalidateTeamDetailCache(normalizedTeamId);
        invalidateWorkspaceTeamCache(normalizedTeamId);

        const listCache = (globalThis as { __onbureTeamsListCache?: Map<string, unknown> }).__onbureTeamsListCache;
        const listSyncCache = (globalThis as { __onbureTeamsSyncCache?: Map<string, unknown> }).__onbureTeamsSyncCache;
        listCache?.delete(currentUserId);
        listSyncCache?.delete(currentUserId);
        if (team.primaryOwnerUserId) {
            listCache?.delete(team.primaryOwnerUserId);
            listSyncCache?.delete(team.primaryOwnerUserId);
        }

        await appendAuditLog({
            category: "team",
            event: "team_member_left",
            actorUserId: currentUserId,
            targetUserId: team.primaryOwnerUserId || undefined,
            teamId: normalizedTeamId,
            scope: "team",
            metadata: {
                teamName: team.name || normalizedTeamId,
                leftUserId: currentUserId,
                leftUsername: String(session.user?.name || currentUserId).trim() || currentUserId,
                leftRole: me.role,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("POST /api/teams/[teamId]/leave failed", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        );
    }
}
