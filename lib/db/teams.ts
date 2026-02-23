
import { supabaseRest } from "@/lib/supabase-rest";
import { v4 as uuidv4 } from "uuid";

// Strict Column Names Mapping:
// Teams DB: team_id, team_name, description, visibility, primary_owner_user_id, created_at
// TeamMembers DB: team_id, user_id, role, status, joined_at

export type TeamVisibility = "Public" | "Private";
export type TeamStage = "idea" | "mvp" | "beta" | "launched";
export type TeamWorkStyle = "async" | "sync" | "hybrid";
export type CommitmentHoursPerWeek = "1-5" | "6-10" | "11-20" | "21-40" | "40+";

export interface Team {
    id: string; // Notion Page ID or UUID if Supabase only
    teamId: string; // UUID
    name: string;
    description: string;
    visibility: TeamVisibility;
    primaryOwnerUserId: string;
    recruitingRoles?: string[];
    language?: string;
    stage?: TeamStage;
    timezone?: string;
    teamSize?: number;
    openSlots?: number;
    commitmentHoursPerWeek?: CommitmentHoursPerWeek;
    workStyle?: TeamWorkStyle;
}

export interface TeamMember {
    id: string;
    teamId: string;
    userId: string;
    role: "Owner" | "Admin" | "Member";
    status: "Active" | "Away" | "Inactive";
    joinedAt: string;
}

export interface TeamMembershipSummary {
    teamId: string;
    teamName: string;
    role: "Owner" | "Admin" | "Member";
    status: "Active" | "Away" | "Inactive";
    joinedAt: string;
    visibility: TeamVisibility;
}

interface SupabaseTeamRow {
    team_id: string;
    name: string;
    description: string | null;
    visibility: string | null;
    primary_owner_user_id: string;
    recruiting_roles: string[] | null;
    language: string | null;
    stage: string | null;
    timezone: string | null;
    team_size: number | null;
    open_slots: number | null;
    commitment_hours_per_week: string | null;
    work_style: string | null;
    created_at: string | null;
}

interface SupabaseTeamMemberRow {
    id: string;
    team_id: string;
    user_id: string;
    role: string;
    status: string;
    joined_at: string;
}

function mapSupabaseTeamRow(row: SupabaseTeamRow): Team {
    return {
        id: row.team_id,
        teamId: row.team_id,
        name: row.name || row.team_id,
        description: row.description || "",
        visibility: normalizeVisibility(row.visibility),
        primaryOwnerUserId: row.primary_owner_user_id || "",
        recruitingRoles: Array.isArray(row.recruiting_roles) ? row.recruiting_roles : [],
        language: row.language || undefined,
        stage: normalizeStage(row.stage),
        timezone: row.timezone || undefined,
        teamSize: typeof row.team_size === "number" ? row.team_size : undefined,
        openSlots: typeof row.open_slots === "number" ? row.open_slots : undefined,
        commitmentHoursPerWeek: normalizeCommitment(row.commitment_hours_per_week),
        workStyle: normalizeWorkStyle(row.work_style),
    };
}

function normalizeMemberStatus(value: string | null | undefined): "Active" | "Away" | "Inactive" {
    const lowered = String(value || "").trim().toLowerCase();
    if (lowered === "away") return "Away";
    if (lowered === "active") return "Active";
    return "Inactive";
}

function normalizeMemberRole(value: string | null | undefined): "Owner" | "Admin" | "Member" {
    const lowered = String(value || "").trim().toLowerCase();
    if (lowered === "owner") return "Owner";
    if (lowered === "admin") return "Admin";
    return "Member";
}

function roleRank(role: "Owner" | "Admin" | "Member"): number {
    if (role === "Owner") return 3;
    if (role === "Admin") return 2;
    return 1;
}

function mapSupabaseTeamMemberRow(
    row: SupabaseTeamMemberRow,
    primaryOwnerUserId?: string | null
): TeamMember {
    const normalizedRole = normalizeMemberRole(row.role);
    const role = primaryOwnerUserId && row.user_id === primaryOwnerUserId ? "Owner" : normalizedRole;
    return {
        id: row.id,
        teamId: row.team_id,
        userId: row.user_id,
        role,
        status: normalizeMemberStatus(row.status),
        joinedAt: row.joined_at || "",
    };
}

export function isActiveMemberStatus(status: string | null | undefined): boolean {
    const normalized = String(status || "").trim().toLowerCase();
    if (!normalized) return false;
    if (normalized.includes("inactive") || normalized.includes("비활")) return false;
    if (normalized === "active" || normalized.includes("active") || normalized.includes("활동")) return true;
    return false;
}

export function normalizeVisibility(value: string | null | undefined): TeamVisibility {
    return String(value || "").trim().toLowerCase() === "public" ? "Public" : "Private";
}

export function normalizeStage(value: string | null | undefined): TeamStage | undefined {
    const lower = String(value || "").trim().toLowerCase();
    if (lower === "idea" || lower === "mvp" || lower === "beta" || lower === "launched") {
        return lower;
    }
    return undefined;
}

export function normalizeWorkStyle(value: string | null | undefined): TeamWorkStyle | undefined {
    const lower = String(value || "").trim().toLowerCase();
    if (lower === "async" || lower === "sync" || lower === "hybrid") {
        return lower;
    }
    return undefined;
}

export function normalizeCommitment(value: string | null | undefined): CommitmentHoursPerWeek | undefined {
    const normalized = String(value || "").trim();
    if (normalized === "1-5" || normalized === "6-10" || normalized === "11-20" || normalized === "21-40" || normalized === "40+") {
        return normalized;
    }
    return undefined;
}

export function normalizeRoleTags(input: string[] | undefined) {
    if (!Array.isArray(input)) return [];
    const unique = new Set<string>();
    for (const raw of input) {
        const value = String(raw || "").trim().replace(/\s+/g, " ");
        if (!value) continue;
        unique.add(value);
    }
    return Array.from(unique);
}

export async function getPublicTeams(): Promise<Team[]> {
    const rows = (await supabaseRest("/teams?select=*")) as SupabaseTeamRow[];
    return rows
        .map(mapSupabaseTeamRow)
        .filter((team) => team.visibility === "Public");
}

export async function getTeamById(teamId: string): Promise<Team | null> {
    const rows = (await supabaseRest(
        `/teams?select=*&team_id=eq.${encodeURIComponent(teamId)}&limit=1`
    )) as SupabaseTeamRow[];
    if (!rows.length) return null;
    return mapSupabaseTeamRow(rows[0]);
}

export async function updateTeamProfile(
    teamId: string,
    data: {
        name?: string;
        description?: string;
        visibility?: TeamVisibility | "public" | "private";
        recruitingRoles?: string[];
        language?: string;
        stage?: TeamStage;
        timezone?: string;
        teamSize?: number;
        openSlots?: number;
        commitmentHoursPerWeek?: CommitmentHoursPerWeek;
        workStyle?: TeamWorkStyle;
    }
) {
    const existingTeam = await getTeamById(teamId);
    if (!existingTeam) {
        throw new Error("Team not found");
    }

    const normalizedName = typeof data.name === "string" ? data.name.trim().replace(/\s+/g, " ") : undefined;
    const normalizedDescription = typeof data.description === "string" ? data.description.trim().replace(/\s+/g, " ") : undefined;
    const normalizedVisibility = data.visibility ? normalizeVisibility(data.visibility) : undefined;
    const normalizedRoles = Array.isArray(data.recruitingRoles) ? normalizeRoleTags(data.recruitingRoles) : undefined;
    const normalizedLanguage = typeof data.language === "string" ? data.language.trim() : undefined;
    const normalizedStage = data.stage ? normalizeStage(data.stage) : undefined;
    const normalizedTimezone = typeof data.timezone === "string" ? data.timezone.trim() : undefined;
    const normalizedTeamSize =
        Number.isFinite(Number(data.teamSize)) && data.teamSize !== undefined
            ? Math.max(1, Math.floor(Number(data.teamSize)))
            : undefined;
    const normalizedOpenSlots =
        Number.isFinite(Number(data.openSlots)) && data.openSlots !== undefined
            ? Math.max(0, Math.floor(Number(data.openSlots)))
            : undefined;
    const normalizedCommitment = data.commitmentHoursPerWeek ? normalizeCommitment(data.commitmentHoursPerWeek) : undefined;
    const normalizedWorkStyle = data.workStyle ? normalizeWorkStyle(data.workStyle) : undefined;

    const patch: Record<string, any> = {};
    if (normalizedName !== undefined && normalizedName.length > 0) patch.name = normalizedName;
    if (normalizedDescription !== undefined) patch.description = normalizedDescription;
    if (normalizedVisibility !== undefined) patch.visibility = normalizedVisibility;
    if (normalizedRoles !== undefined) patch.recruiting_roles = normalizedRoles;
    if (normalizedLanguage !== undefined) patch.language = normalizedLanguage || null;
    if (normalizedStage !== undefined) patch.stage = normalizedStage;
    if (normalizedTimezone !== undefined) patch.timezone = normalizedTimezone || null;
    if (normalizedTeamSize !== undefined) patch.team_size = normalizedTeamSize;
    if (normalizedOpenSlots !== undefined) patch.open_slots = normalizedOpenSlots;
    if (normalizedCommitment !== undefined) patch.commitment_hours_per_week = normalizedCommitment;
    if (normalizedWorkStyle !== undefined) patch.work_style = normalizedWorkStyle;

    if (Object.keys(patch).length === 0) {
        return existingTeam;
    }

    const rows = (await supabaseRest(
        `/teams?team_id=eq.${encodeURIComponent(teamId)}`,
        {
            method: "PATCH",
            prefer: "return=representation",
            body: patch,
        }
    )) as SupabaseTeamRow[];

    if (!rows.length) {
        throw new Error("Team not found");
    }

    return mapSupabaseTeamRow(rows[0]);
}

export async function createTeam(data: {
    name: string;
    description?: string;
    visibility?: TeamVisibility | "public" | "private";
    ownerId: string;
    recruitingRoles?: string[];
    language?: string;
    stage?: TeamStage;
    timezone?: string;
    teamSize?: number;
    openSlots?: number;
    commitmentHoursPerWeek?: CommitmentHoursPerWeek;
    workStyle?: TeamWorkStyle;
}) {
    const teamId = uuidv4();
    const description = (data.description || "").trim().replace(/\s+/g, " ");
    const visibility = normalizeVisibility(data.visibility);
    const recruitingRoles = normalizeRoleTags(data.recruitingRoles);
    const language = (data.language || "").trim();
    const stage = normalizeStage(data.stage) || "idea";
    const timezone = (data.timezone || "").trim();
    const teamSize = Number.isFinite(Number(data.teamSize)) ? Math.max(1, Math.floor(Number(data.teamSize))) : 1;
    const openSlots = Number.isFinite(Number(data.openSlots)) ? Math.max(0, Math.floor(Number(data.openSlots))) : 0;
    const commitmentHoursPerWeek = normalizeCommitment(data.commitmentHoursPerWeek);
    const workStyle = normalizeWorkStyle(data.workStyle) || "hybrid";

    await supabaseRest("/teams", {
        method: "POST",
        prefer: "return=representation",
        body: {
            team_id: teamId,
            name: data.name,
            description,
            visibility,
            primary_owner_user_id: data.ownerId,
            recruiting_roles: recruitingRoles,
            language: language || null,
            stage,
            timezone: timezone || null,
            team_size: teamSize,
            open_slots: openSlots,
            commitment_hours_per_week: commitmentHoursPerWeek || null,
            work_style: workStyle,
        },
    });

    await addMemberToTeam(teamId, data.ownerId, "Owner");

    return {
        teamId,
        name: data.name,
        description,
        recruitingRoles,
        language: language || undefined,
        stage,
        timezone: timezone || undefined,
        teamSize,
        openSlots,
        commitmentHoursPerWeek,
        workStyle,
        visibility,
    };
}

export async function deleteTeam(teamId: string) {
    const normalizedTeamId = String(teamId || "").trim();
    if (!normalizedTeamId) return;

    await supabaseRest(
        `/teams?team_id=eq.${encodeURIComponent(normalizedTeamId)}`,
        {
            method: "DELETE",
            prefer: "return=minimal",
        }
    );
    return;
}

export async function addMemberToTeam(teamId: string, userId: string, role: "Owner" | "Admin" | "Member" = "Member") {
    const existing = (await supabaseRest(
        `/team_members?select=*&team_id=eq.${encodeURIComponent(teamId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`
    )) as SupabaseTeamMemberRow[];

    if (existing.length > 0) {
        const row = existing[0];
        const needsStatus = normalizeMemberStatus(row.status) !== "Active";
        const currentRole = normalizeMemberRole(row.role);
        const desiredRole = normalizeMemberRole(role);
        const shouldPromoteRole = roleRank(desiredRole) > roleRank(currentRole);
        if (needsStatus || shouldPromoteRole) {
            const patch: Record<string, any> = {};
            if (needsStatus) patch.status = "Active";
            if (shouldPromoteRole) patch.role = desiredRole;
            await supabaseRest(
                `/team_members?id=eq.${encodeURIComponent(row.id)}`,
                {
                    method: "PATCH",
                    prefer: "return=minimal",
                    body: patch,
                }
            );
        }
        return;
    }

    const desiredRole = normalizeMemberRole(role);
    await supabaseRest("/team_members", {
        method: "POST",
        prefer: "return=minimal",
        body: {
            team_id: teamId,
            user_id: userId,
            role: desiredRole,
            status: "Active",
        },
    });
    return;
}

export async function updateTeamMemberRole(
    teamId: string,
    userId: string,
    role: "Admin" | "Member"
) {
    const desiredRole = normalizeMemberRole(role);
    if (desiredRole === "Owner") return;

    await supabaseRest(
        `/team_members?team_id=eq.${encodeURIComponent(teamId)}&user_id=eq.${encodeURIComponent(userId)}`,
        {
            method: "PATCH",
            prefer: "return=minimal",
            body: { role: desiredRole },
        }
    );
    return;
}

export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
    const ownerRows = (await supabaseRest(
        `/teams?select=primary_owner_user_id&team_id=eq.${encodeURIComponent(teamId)}&limit=1`
    )) as Array<{ primary_owner_user_id?: string | null }>;
    const primaryOwnerUserId = String(ownerRows[0]?.primary_owner_user_id || "").trim() || null;
    const rows = (await supabaseRest(
        `/team_members?select=*&team_id=eq.${encodeURIComponent(teamId)}&order=joined_at.asc`
    )) as SupabaseTeamMemberRow[];
    return rows.map((row) => mapSupabaseTeamMemberRow(row, primaryOwnerUserId));
}

export async function getTeamsForUser(userId: string): Promise<Team[]> {
    const memberships = (await supabaseRest(
        `/team_members?select=team_id&user_id=eq.${encodeURIComponent(userId)}`
    )) as Array<{ team_id: string }>;
    const teamIds = Array.from(new Set(memberships.map((row) => row.team_id).filter(Boolean)));
    if (!teamIds.length) return [];

    const teams = await Promise.all(teamIds.map((teamId) => getTeamById(teamId)));
    return teams.filter((team): team is Team => Boolean(team));
}

export async function getTeamMembershipsForUser(userId: string): Promise<TeamMembershipSummary[]> {
    const memberships = (await supabaseRest(
        `/team_members?select=*&user_id=eq.${encodeURIComponent(userId)}&order=joined_at.asc`
    )) as SupabaseTeamMemberRow[];

    if (!memberships.length) return [];

    const teamIds = Array.from(new Set(memberships.map((m) => m.team_id).filter(Boolean)));
    const teams = await Promise.all(teamIds.map((teamId) => getTeamById(teamId)));
    const teamById = new Map(
        teams
            .filter((team): team is Team => Boolean(team))
            .map((team) => [team.teamId, team])
    );

    return memberships.map((row) => {
        const mapped = mapSupabaseTeamMemberRow(row);
        const team = teamById.get(mapped.teamId);
        const role = team?.primaryOwnerUserId && mapped.userId === team.primaryOwnerUserId
            ? "Owner"
            : mapped.role;
        return {
            teamId: mapped.teamId,
            teamName: team?.name || mapped.teamId,
            role,
            status: mapped.status,
            joinedAt: mapped.joinedAt,
            visibility: team?.visibility || "Private",
        };
    });
}

export async function hasTeamMembershipRecord(teamId: string, userId: string): Promise<boolean> {
    const rows = await supabaseRest(
        `/team_members?select=team_id&team_id=eq.${encodeURIComponent(teamId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`
    ) as any[];
    return rows.length > 0;
}

export async function leaveTeam(teamId: string, userId: string) {
    await supabaseRest(
        `/team_members?team_id=eq.${encodeURIComponent(teamId)}&user_id=eq.${encodeURIComponent(userId)}`,
        {
            method: "DELETE",
            prefer: "return=minimal"
        }
    );
}
