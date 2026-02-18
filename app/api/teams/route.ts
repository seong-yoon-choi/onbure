import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createTeam, getTeamMembershipsForUser } from "@/lib/db/teams";
import { syncAcceptedTeamMembershipsForUser } from "@/lib/db/requests";
import { appendAuditLog } from "@/lib/db/audit";

export const runtime = "nodejs";

interface TeamMembershipListCacheEntry {
    expiresAt: number;
    payload: unknown[];
}

interface TeamSyncCacheEntry {
    expiresAt: number;
}

const TEAM_LIST_CACHE_TTL_MS = 15_000;
const TEAM_SYNC_TTL_MS = 45_000;

declare global {
    var __onbureTeamsListCache: Map<string, TeamMembershipListCacheEntry> | undefined;
    var __onbureTeamsSyncCache: Map<string, TeamSyncCacheEntry> | undefined;
}

const teamListCache =
    globalThis.__onbureTeamsListCache ||
    (globalThis.__onbureTeamsListCache = new Map<string, TeamMembershipListCacheEntry>());
const teamSyncCache =
    globalThis.__onbureTeamsSyncCache ||
    (globalThis.__onbureTeamsSyncCache = new Map<string, TeamSyncCacheEntry>());

function isNotionRateLimitedError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes("Notion API Error [429]") || message.includes("\"code\":\"rate_limited\"");
}

async function syncAcceptedMembershipsWithThrottle(userId: string) {
    const now = Date.now();
    const syncState = teamSyncCache.get(userId);
    if (syncState && syncState.expiresAt > now) return;

    await syncAcceptedTeamMembershipsForUser(userId);
    teamSyncCache.set(userId, { expiresAt: now + TEAM_SYNC_TTL_MS });
}

function normalizeRoles(input: unknown): string[] {
    if (!Array.isArray(input)) return [];
    const values = input
        .map((item) => String(item || "").trim().replace(/\s+/g, " "))
        .filter(Boolean);
    return Array.from(new Set(values));
}

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = String((session.user as { id?: string } | undefined)?.id || "");
    const now = Date.now();
    const cached = teamListCache.get(userId);
    if (cached && cached.expiresAt > now) {
        return NextResponse.json(cached.payload);
    }

    try {
        await syncAcceptedMembershipsWithThrottle(userId).catch((error) => {
            if (isNotionRateLimitedError(error)) {
                return;
            }
            throw error;
        });

        const memberships = await getTeamMembershipsForUser(userId);
        teamListCache.set(userId, {
            payload: memberships,
            expiresAt: now + TEAM_LIST_CACHE_TTL_MS,
        });
        return NextResponse.json(memberships);
    } catch (error) {
        if (isNotionRateLimitedError(error)) {
            if (cached?.payload) {
                return NextResponse.json(cached.payload);
            }
            return NextResponse.json([]);
        }
        console.error("GET /api/teams failed", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ownerId = String((session.user as { id?: string } | undefined)?.id || "").trim();
    if (!ownerId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json().catch(() => ({}));
        const teamName = String(body?.teamName || body?.team_name || "").trim().replace(/\s+/g, " ");
        const description = String(body?.description || "").trim().slice(0, 300);
        const language = String(body?.language || "").trim();
        const stage = String(body?.stage || "").trim().toLowerCase();
        const timezone = String(body?.timezone || "").trim();
        const teamSizeRaw = Number(body?.teamSize ?? body?.team_size);
        const openSlotsRaw = Number(body?.openSlots ?? body?.open_slots);
        const commitmentHoursPerWeek = String(body?.commitmentHoursPerWeek || body?.commitment_hours_per_week || "").trim();
        const workStyle = String(body?.workStyle || body?.work_style || "").trim().toLowerCase();
        const visibilityRaw = String(body?.visibility || "").trim().toLowerCase();
        const recruitingRoles = normalizeRoles(body?.recruitingRoles || body?.recruiting_roles);

        if (!teamName) {
            return NextResponse.json({ error: "Team name is required." }, { status: 400 });
        }

        const created = await createTeam({
            name: teamName,
            description,
            language,
            recruitingRoles,
            stage: stage === "idea" || stage === "mvp" || stage === "beta" || stage === "launched" ? stage : "idea",
            timezone: timezone || undefined,
            teamSize: Number.isFinite(teamSizeRaw) ? teamSizeRaw : 1,
            openSlots: Number.isFinite(openSlotsRaw) ? openSlotsRaw : 0,
            commitmentHoursPerWeek:
                commitmentHoursPerWeek === "1-5" ||
                commitmentHoursPerWeek === "6-10" ||
                commitmentHoursPerWeek === "11-20" ||
                commitmentHoursPerWeek === "21-40" ||
                commitmentHoursPerWeek === "40+"
                    ? commitmentHoursPerWeek
                    : undefined,
            workStyle: workStyle === "async" || workStyle === "sync" || workStyle === "hybrid" ? workStyle : "hybrid",
            visibility: visibilityRaw === "public" ? "Public" : "Private",
            ownerId,
        });

        teamListCache.delete(ownerId);
        teamSyncCache.delete(ownerId);
        await appendAuditLog({
            category: "team",
            event: "team_created",
            actorUserId: ownerId,
            teamId: created.teamId,
            scope: "team",
            metadata: {
                visibility: created.visibility,
                name: teamName,
            },
        });

        return NextResponse.json({
            success: true,
            teamId: created.teamId,
            visibility: created.visibility,
        });
    } catch (error) {
        console.error("POST /api/teams failed", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        );
    }
}
