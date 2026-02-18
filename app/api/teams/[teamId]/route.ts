import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteTeam, getTeamById, getTeamMembers, isActiveMemberStatus, updateTeamProfile } from "@/lib/db/teams";
import { syncAcceptedTeamMembershipsForUser } from "@/lib/db/requests";
import { listUsers } from "@/lib/db/users";
import { appendAuditLog } from "@/lib/db/audit";

export const runtime = "nodejs";

interface TeamDetailCacheEntry {
    expiresAt: number;
    payload: unknown;
}

interface TeamSyncCacheEntry {
    expiresAt: number;
}

const TEAM_DETAIL_CACHE_TTL_MS = 10_000;
const TEAM_DETAIL_SYNC_TTL_MS = 45_000;

declare global {
    var __onbureTeamDetailCache: Map<string, TeamDetailCacheEntry> | undefined;
    var __onbureTeamDetailSyncCache: Map<string, TeamSyncCacheEntry> | undefined;
}

const teamDetailCache =
    globalThis.__onbureTeamDetailCache ||
    (globalThis.__onbureTeamDetailCache = new Map<string, TeamDetailCacheEntry>());
const teamDetailSyncCache =
    globalThis.__onbureTeamDetailSyncCache ||
    (globalThis.__onbureTeamDetailSyncCache = new Map<string, TeamSyncCacheEntry>());

function withProfileDefaults(team: any, activeMemberCount: number) {
    return {
        ...team,
        stage: team?.stage || "idea",
        timezone: team?.timezone || "UTC",
        openSlots: typeof team?.openSlots === "number" ? team.openSlots : 0,
        commitmentHoursPerWeek: team?.commitmentHoursPerWeek || "6-10",
        workStyle: team?.workStyle || "hybrid",
        teamSize: typeof team?.teamSize === "number" ? team.teamSize : activeMemberCount,
    };
}

function isNotionRateLimitedError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes("Notion API Error [429]") || message.includes("\"code\":\"rate_limited\"");
}

function getTeamDetailCacheKey(userId: string, teamId: string) {
    return `${userId}:${teamId}`;
}

function invalidateTeamDetailCache(teamId: string) {
    const suffix = `:${teamId}`;
    for (const key of teamDetailCache.keys()) {
        if (key.endsWith(suffix)) {
            teamDetailCache.delete(key);
        }
    }
}

async function syncTeamMembershipsWithThrottle(userId: string, teamId: string) {
    const now = Date.now();
    const syncKey = getTeamDetailCacheKey(userId, teamId);
    const syncState = teamDetailSyncCache.get(syncKey);
    if (syncState && syncState.expiresAt > now) return;

    await syncAcceptedTeamMembershipsForUser(userId, teamId);
    teamDetailSyncCache.set(syncKey, { expiresAt: now + TEAM_DETAIL_SYNC_TTL_MS });
}

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ teamId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;
    const currentUserId = String((session.user as { id?: string } | undefined)?.id || "");
    if (!currentUserId.trim()) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const now = Date.now();
    const cacheKey = getTeamDetailCacheKey(currentUserId, teamId);
    const cached = teamDetailCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
        return NextResponse.json(cached.payload);
    }

    try {
        await syncTeamMembershipsWithThrottle(currentUserId, teamId).catch((error) => {
            if (isNotionRateLimitedError(error)) {
                return;
            }
            throw error;
        });

        const team = await getTeamById(teamId);
        if (!team) {
            return NextResponse.json({ error: "Team not found." }, { status: 404 });
        }

        const members = await getTeamMembers(teamId);
        const activeMembers = members.filter((member) => isActiveMemberStatus(member.status));
        const isMember = activeMembers.some((member) => member.userId === currentUserId);
        const isOwner = activeMembers.some((member) => member.userId === currentUserId && member.role === "Owner");

        if (team.visibility === "Private" && !isMember) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const users = await listUsers();
        const usernameByUserId = new Map(
            users.map((user) => [user.userId, user.username || user.userId])
        );

        const membersWithUsername = activeMembers.map((member) => ({
            ...member,
            username: usernameByUserId.get(member.userId) || member.userId,
        }));

        const payload = {
            ...withProfileDefaults(team, activeMembers.length),
            members: membersWithUsername,
            isMember,
            isOwner,
        };

        teamDetailCache.set(cacheKey, {
            payload,
            expiresAt: now + TEAM_DETAIL_CACHE_TTL_MS,
        });

        return NextResponse.json(payload);
    } catch (error) {
        if (isNotionRateLimitedError(error)) {
            if (cached?.payload) {
                return NextResponse.json(cached.payload);
            }
            return NextResponse.json(
                { error: "Rate limited by Notion. Please retry in a moment." },
                { status: 503 }
            );
        }
        console.error("GET /api/teams/[teamId] failed", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ teamId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;
    const currentUserId = String((session.user as { id?: string } | undefined)?.id || "");
    if (!currentUserId.trim()) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await syncTeamMembershipsWithThrottle(currentUserId, teamId).catch((error) => {
        if (isNotionRateLimitedError(error)) return;
        throw error;
    });

    try {
        const team = await getTeamById(teamId);
        if (!team) {
            return NextResponse.json({ error: "Team not found." }, { status: 404 });
        }

        const members = await getTeamMembers(teamId);
        const isOwner = members.some(
            (member) => member.userId === currentUserId && isActiveMemberStatus(member.status) && member.role === "Owner"
        );
        if (!isOwner) {
            return NextResponse.json({ error: "Only owner can edit this team profile." }, { status: 403 });
        }

        const body = await req.json().catch(() => ({}));
        const updated = await updateTeamProfile(teamId, {
            name: typeof body?.name === "string" ? body.name : undefined,
            description: typeof body?.description === "string" ? body.description : undefined,
            stage: typeof body?.stage === "string" ? body.stage.toLowerCase() : undefined,
            timezone: typeof body?.timezone === "string" ? body.timezone : undefined,
            language: typeof body?.language === "string" ? body.language : undefined,
            teamSize: Number.isFinite(Number(body?.teamSize)) ? Number(body.teamSize) : undefined,
            openSlots: Number.isFinite(Number(body?.openSlots)) ? Number(body.openSlots) : undefined,
            commitmentHoursPerWeek:
                typeof body?.commitmentHoursPerWeek === "string" ? body.commitmentHoursPerWeek : undefined,
            workStyle: typeof body?.workStyle === "string" ? body.workStyle.toLowerCase() : undefined,
            visibility: typeof body?.visibility === "string" ? body.visibility : undefined,
            recruitingRoles: Array.isArray(body?.recruitingRoles) ? body.recruitingRoles : undefined,
        });

        const activeMemberCount = members.filter((member) => isActiveMemberStatus(member.status)).length;
        invalidateTeamDetailCache(teamId);
        (globalThis as any).__onbureTeamsListCache?.delete?.(currentUserId);
        await appendAuditLog({
            category: "team",
            event: "team_profile_updated",
            actorUserId: currentUserId,
            teamId,
            scope: "team",
            metadata: {
                visibility: updated.visibility,
                stage: updated.stage,
            },
        });
        return NextResponse.json({ success: true, team: withProfileDefaults(updated, activeMemberCount) });
    } catch (error) {
        if (isNotionRateLimitedError(error)) {
            return NextResponse.json(
                { error: "Rate limited by Notion. Please retry in a moment." },
                { status: 503 }
            );
        }
        console.error("PATCH /api/teams/[teamId] failed", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ teamId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;
    const currentUserId = String((session.user as { id?: string } | undefined)?.id || "");
    if (!currentUserId.trim()) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await syncTeamMembershipsWithThrottle(currentUserId, teamId).catch((error) => {
        if (isNotionRateLimitedError(error)) return;
        throw error;
    });

    try {
        const team = await getTeamById(teamId);
        if (!team) {
            return NextResponse.json({ error: "Team not found." }, { status: 404 });
        }

        const members = await getTeamMembers(teamId);
        const isOwner = members.some(
            (member) => member.userId === currentUserId && isActiveMemberStatus(member.status) && member.role === "Owner"
        );
        if (!isOwner) {
            return NextResponse.json({ error: "Only owner can delete this team." }, { status: 403 });
        }

        await deleteTeam(teamId);
        invalidateTeamDetailCache(teamId);

        const listCache = (globalThis as any).__onbureTeamsListCache as Map<string, unknown> | undefined;
        const listSyncCache = (globalThis as any).__onbureTeamsSyncCache as Map<string, unknown> | undefined;
        const memberUserIds = new Set(
            members
                .filter((member) => isActiveMemberStatus(member.status))
                .map((member) => member.userId)
        );
        memberUserIds.add(currentUserId);
        for (const userId of memberUserIds) {
            listCache?.delete?.(userId);
            listSyncCache?.delete?.(userId);
        }
        await appendAuditLog({
            category: "team",
            event: "team_deleted",
            actorUserId: currentUserId,
            teamId,
            scope: "team",
            metadata: {
                memberCount: memberUserIds.size,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        if (isNotionRateLimitedError(error)) {
            return NextResponse.json(
                { error: "Rate limited by Notion. Please retry in a moment." },
                { status: 503 }
            );
        }
        console.error("DELETE /api/teams/[teamId] failed", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        );
    }
}
