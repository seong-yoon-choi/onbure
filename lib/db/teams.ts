import { notion, getDatabaseId, getTextValue, getSelectValue } from "@/lib/notion-client";
import { getDatabaseSchema, getTitlePropertyName } from "@/lib/notion-schema";
import { getUserByUserId } from "@/lib/db/users";
import { isSupabaseBackend } from "@/lib/db/backend";
import { supabaseRest } from "@/lib/supabase-rest";
import { v4 as uuidv4 } from "uuid";

// Strict Column Names Mapping:
// Teams DB: team_id, team_name, description, visibility, primary_owner_user_id, created_at
// TeamMembers DB: team_id, user_id, role, status, joined_at

const DB_TEAMS = getDatabaseId("NOTION_DB_TEAMS");
const DB_MEMBERS = getDatabaseId("NOTION_DB_TEAM_MEMBERS");

export type TeamVisibility = "Public" | "Private";
export type TeamStage = "idea" | "mvp" | "beta" | "launched";
export type TeamWorkStyle = "async" | "sync" | "hybrid";
export type CommitmentHoursPerWeek = "1-5" | "6-10" | "11-20" | "21-40" | "40+";

export interface Team {
    id: string; // Notion Page ID
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

type TeamPropertyKeys = {
    teamId?: string;
    name?: string;
    description?: string;
    visibility?: string;
    primaryOwnerUserId?: string;
    recruitingRoles?: string;
    language?: string;
    stage?: string;
    timezone?: string;
    teamSize?: string;
    openSlots?: string;
    commitmentHoursPerWeek?: string;
    workStyle?: string;
    ownersUserIds?: string;
    membersUserIds?: string;
    createdAt?: string;
};

function normalizePropertyKey(value: string): string {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findPropertyKey(properties: Record<string, any>, candidates: string[]): string | undefined {
    for (const candidate of candidates) {
        if (candidate in properties) return candidate;
    }

    const normalizedCandidates = candidates
        .map((candidate) => normalizePropertyKey(candidate))
        .filter(Boolean);
    for (const key of Object.keys(properties)) {
        const normalizedKey = normalizePropertyKey(key);
        if (normalizedCandidates.includes(normalizedKey)) {
            return key;
        }
    }

    for (const key of Object.keys(properties)) {
        const normalizedKey = normalizePropertyKey(key);
        if (normalizedCandidates.some((candidate) => normalizedKey.includes(candidate) || candidate.includes(normalizedKey))) {
            return key;
        }
    }

    return undefined;
}

function getSchemaOptionNames(propertyDef: any): string[] {
    if (!propertyDef) return [];

    if (propertyDef.type === "select" && Array.isArray(propertyDef.select?.options)) {
        return propertyDef.select.options.map((option: any) => String(option?.name || ""));
    }

    if (propertyDef.type === "status" && Array.isArray(propertyDef.status?.options)) {
        return propertyDef.status.options.map((option: any) => String(option?.name || ""));
    }

    return [];
}

function hasAnyToken(value: string, tokens: string[]): boolean {
    const normalizedValue = normalizePropertyKey(value);
    return tokens.some((token) => normalizedValue.includes(normalizePropertyKey(token)));
}

function resolveTeamPropertyKeys(properties: Record<string, any>): TeamPropertyKeys {
    const keys: TeamPropertyKeys = {
        teamId: findPropertyKey(properties, ["team_id", "team id", "teamid"]),
        name: findPropertyKey(properties, ["team_name", "team name", "teamname", "name"]),
        description: findPropertyKey(properties, ["description", "team_description", "team description", "about", "intro"]),
        visibility: findPropertyKey(properties, ["visibility"]),
        primaryOwnerUserId: findPropertyKey(properties, ["primary_owner_user_id", "primary owner user id", "primary owner"]),
        recruitingRoles: findPropertyKey(properties, ["recruiting_roles", "recruiting role", "recruiting roles", "roles"]),
        language: findPropertyKey(properties, ["language", "lang"]),
        stage: findPropertyKey(properties, ["stage"]),
        timezone: findPropertyKey(properties, ["timezone", "time zone"]),
        teamSize: findPropertyKey(properties, ["team_size", "team size", "teamsize", "member count"]),
        openSlots: findPropertyKey(properties, ["open_slots", "open slot", "open slots", "openslots", "vacancy"]),
        commitmentHoursPerWeek: findPropertyKey(properties, [
            "commitment_hours_per_week",
            "commitment hours per week",
            "commitment hours",
            "hours per week",
            "commitment",
        ]),
        workStyle: findPropertyKey(properties, ["work_style", "work style", "workstyle"]),
        ownersUserIds: findPropertyKey(properties, ["owners_user_ids", "owner_user_ids", "owners user ids"]),
        membersUserIds: findPropertyKey(properties, ["members_user_ids", "member_user_ids", "members user ids"]),
        createdAt: findPropertyKey(properties, ["created_at", "created at"]),
    };

    const entries = Object.entries(properties);
    const assigned = new Set(Object.values(keys).filter((value): value is string => Boolean(value)));
    const isAvailable = (key: string) => !assigned.has(key);
    const assign = (field: keyof TeamPropertyKeys, key?: string) => {
        if (!key) return;
        if (!isAvailable(key)) return;
        if (keys[field]) return;
        keys[field] = key;
        assigned.add(key);
    };

    const findByTypesAndName = (types: string[], tokens: string[]) =>
        entries.find(([key, def]) => isAvailable(key) && types.includes(String(def?.type || "")) && hasAnyToken(key, tokens))?.[0];
    const findByType = (type: string) => entries.find(([key, def]) => isAvailable(key) && def?.type === type)?.[0];
    const findByOptionNames = (optionTokens: string[]) =>
        entries.find(([key, def]) => {
            if (!isAvailable(key)) return false;
            if (!(def?.type === "select" || def?.type === "status")) return false;
            const optionNames = getSchemaOptionNames(def).map((option) => option.toLowerCase());
            return optionTokens.some((token) => optionNames.some((option) => option.includes(token.toLowerCase())));
        })?.[0];

    assign("name", entries.find(([key, def]) => isAvailable(key) && def?.type === "title")?.[0]);
    assign("visibility", findByOptionNames(["public", "private"]));
    assign("stage", findByOptionNames(["idea", "mvp", "beta", "launched"]));
    assign("workStyle", findByOptionNames(["async", "sync", "hybrid"]));
    assign("commitmentHoursPerWeek", findByOptionNames(["1-5", "6-10", "11-20", "21-40", "40+"]));
    assign("language", findByOptionNames(["korean", "english", "japanese", "ko", "en", "ja"]));
    assign("timezone", findByOptionNames(["utc", "asia/", "america/", "europe/", "pacific/"]));

    assign("primaryOwnerUserId", findByTypesAndName(["relation", "rich_text"], ["primary", "owner"]));
    assign("ownersUserIds", findByTypesAndName(["relation", "rich_text", "multi_select"], ["owners", "owner"]));
    assign("membersUserIds", findByTypesAndName(["relation", "rich_text", "multi_select"], ["members", "member"]));
    assign("recruitingRoles", findByTypesAndName(["multi_select", "rich_text"], ["recruit", "role", "position"]));
    assign("createdAt", findByTypesAndName(["date"], ["created"]));

    const numberOrTextSize = findByTypesAndName(["number", "rich_text"], ["team", "size", "member", "count"]);
    assign("teamSize", numberOrTextSize);
    const numberOrTextOpen = findByTypesAndName(["number", "rich_text"], ["open", "slot", "vacanc", "position"]);
    assign("openSlots", numberOrTextOpen);

    assign("description", findByTypesAndName(["rich_text"], ["description", "about", "intro", "summary"]));
    assign("timezone", findByTypesAndName(["select", "rich_text"], ["timezone", "time"]));

    if (!keys.recruitingRoles) assign("recruitingRoles", findByType("multi_select"));
    if (!keys.description) {
        const fallbackDescription = entries.find(([key, def]) => {
            if (!isAvailable(key)) return false;
            if (def?.type !== "rich_text") return false;
            return !hasAnyToken(key, ["id", "owner", "member", "team", "language", "timezone", "stage", "work", "commit"]);
        })?.[0];
        assign("description", fallbackDescription);
    }

    if (!keys.teamSize || !keys.openSlots) {
        const numericCandidates = entries
            .filter(([key, def]) => isAvailable(key) && (def?.type === "number" || def?.type === "rich_text"))
            .map(([key]) => key);
        if (!keys.teamSize && numericCandidates.length > 0) assign("teamSize", numericCandidates[0]);
        if (!keys.openSlots && numericCandidates.length > 1) assign("openSlots", numericCandidates[1]);
    }

    return keys;
}

function readSelectOrText(property: any): string {
    return getSelectValue(property) || getTextValue(property) || "";
}

function normalizeVisibility(value: string | null | undefined): TeamVisibility {
    return String(value || "").trim().toLowerCase() === "public" ? "Public" : "Private";
}

function normalizeStage(value: string | null | undefined): TeamStage | undefined {
    const lower = String(value || "").trim().toLowerCase();
    if (lower === "idea" || lower === "mvp" || lower === "beta" || lower === "launched") {
        return lower;
    }
    return undefined;
}

function normalizeWorkStyle(value: string | null | undefined): TeamWorkStyle | undefined {
    const lower = String(value || "").trim().toLowerCase();
    if (lower === "async" || lower === "sync" || lower === "hybrid") {
        return lower;
    }
    return undefined;
}

function normalizeCommitment(value: string | null | undefined): CommitmentHoursPerWeek | undefined {
    const normalized = String(value || "").trim();
    if (normalized === "1-5" || normalized === "6-10" || normalized === "11-20" || normalized === "21-40" || normalized === "40+") {
        return normalized;
    }
    return undefined;
}

function readNumberValue(property: any): number | undefined {
    if (typeof property?.number === "number" && Number.isFinite(property.number)) {
        return property.number;
    }

    const fromText = Number.parseFloat(readSelectOrText(property).replace(/,/g, ""));
    if (Number.isFinite(fromText)) return fromText;
    return undefined;
}

function readRoleTags(property: any): string[] {
    if (Array.isArray(property?.multi_select)) {
        return property.multi_select
            .map((option: any) => String(option?.name || "").trim())
            .filter(Boolean);
    }

    const text = readSelectOrText(property);
    if (!text) return [];
    return Array.from(
        new Set(
            text
                .split(/[\n,]/)
                .map((value) => value.trim())
                .filter(Boolean)
        )
    );
}

function mapPageToTeam(page: any): Team {
    const props = page.properties as Record<string, any>;
    const keys = resolveTeamPropertyKeys(props);
    const titlePropertyName = Object.keys(props).find((key) => props[key]?.type === "title");
    const titleProp = titlePropertyName ? props[titlePropertyName] : undefined;
    const descriptionProp = keys.description ? props[keys.description] : undefined;
    const legacyOneLinerKey = findPropertyKey(props, ["one_liner", "one liner", "one-liner"]);
    const legacyOneLinerProp = legacyOneLinerKey ? props[legacyOneLinerKey] : undefined;
    const nameProp = keys.name ? props[keys.name] : undefined;
    const recruitingRolesProp = keys.recruitingRoles ? props[keys.recruitingRoles] : undefined;
    const visibilityProp = keys.visibility ? props[keys.visibility] : undefined;
    const primaryOwnerProp = keys.primaryOwnerUserId ? props[keys.primaryOwnerUserId] : undefined;
    const languageProp = keys.language ? props[keys.language] : undefined;
    const stageProp = keys.stage ? props[keys.stage] : undefined;
    const timezoneProp = keys.timezone ? props[keys.timezone] : undefined;
    const teamSizeProp = keys.teamSize ? props[keys.teamSize] : undefined;
    const openSlotsProp = keys.openSlots ? props[keys.openSlots] : undefined;
    const commitmentProp = keys.commitmentHoursPerWeek ? props[keys.commitmentHoursPerWeek] : undefined;
    const workStyleProp = keys.workStyle ? props[keys.workStyle] : undefined;
    const teamIdProp = keys.teamId ? props[keys.teamId] : undefined;
    const descriptionText = readSelectOrText(descriptionProp) || readSelectOrText(legacyOneLinerProp);
    const recruitingRoles = readRoleTags(recruitingRolesProp);
    return {
        id: page.id,
        teamId: getTextValue(teamIdProp),
        name: getTextValue(nameProp) || getTextValue(titleProp),
        description: descriptionText,
        visibility: normalizeVisibility(readSelectOrText(visibilityProp)),
        primaryOwnerUserId: getTextValue(primaryOwnerProp),
        recruitingRoles,
        language: readSelectOrText(languageProp) || undefined,
        stage: normalizeStage(readSelectOrText(stageProp)),
        timezone: readSelectOrText(timezoneProp) || undefined,
        teamSize: readNumberValue(teamSizeProp),
        openSlots: readNumberValue(openSlotsProp),
        commitmentHoursPerWeek: normalizeCommitment(readSelectOrText(commitmentProp)),
        workStyle: normalizeWorkStyle(readSelectOrText(workStyleProp)),
    };
}

export async function getPublicTeams(): Promise<Team[]> {
    if (isSupabaseBackend()) {
        const rows = (await supabaseRest("/teams?select=*")) as SupabaseTeamRow[];
        return rows
            .map(mapSupabaseTeamRow)
            .filter((team) => team.visibility === "Public");
    }

    const schema = await getDatabaseSchema(DB_TEAMS, { forceRefresh: true });
    const properties = (schema?.properties || {}) as Record<string, any>;
    const keys = resolveTeamPropertyKeys(properties);
    const visibilityKey = keys.visibility;
    const visibilityType = visibilityKey ? properties[visibilityKey]?.type : undefined;

    let filter: any = undefined;
    if (visibilityKey && visibilityType === "select") {
        filter = {
            or: [
                { property: visibilityKey, select: { equals: "Public" } },
                { property: visibilityKey, select: { equals: "public" } },
            ],
        };
    } else if (visibilityKey && visibilityType === "status") {
        filter = {
            or: [
                { property: visibilityKey, status: { equals: "Public" } },
                { property: visibilityKey, status: { equals: "public" } },
            ],
        };
    }

    const response = await notion.databases.query({
        database_id: DB_TEAMS,
        filter,
    });
    const teams: Team[] = (response.results as any[]).map(mapPageToTeam);
    if (filter) return teams;
    return teams.filter((team) => team.visibility === "Public");
}

export async function getTeamById(teamId: string): Promise<Team | null> {
    if (isSupabaseBackend()) {
        const rows = (await supabaseRest(
            `/teams?select=*&team_id=eq.${encodeURIComponent(teamId)}&limit=1`
        )) as SupabaseTeamRow[];
        if (!rows.length) return null;
        return mapSupabaseTeamRow(rows[0]);
    }

    const schema = await getDatabaseSchema(DB_TEAMS, { forceRefresh: true });
    const properties = (schema?.properties || {}) as Record<string, any>;
    const keys = resolveTeamPropertyKeys(properties);
    const teamIdKey = keys.teamId;

    if (!teamIdKey || !properties[teamIdKey]) {
        const fullScan = await notion.databases.query({ database_id: DB_TEAMS });
        const matched = (fullScan.results as any[]).map(mapPageToTeam).find((team: Team) => team.teamId === teamId);
        return matched || null;
    }

    const teamIdType = properties[teamIdKey]?.type;
    const filter =
        teamIdType === "title"
            ? { property: teamIdKey, title: { equals: teamId } }
            : { property: teamIdKey, rich_text: { equals: teamId } };

    const response = await notion.databases.query({
        database_id: DB_TEAMS,
        filter,
    });

    if (response.results.length === 0) return null;
    return mapPageToTeam(response.results[0]);
}

const normalizeRoleTags = (input: string[] | undefined) => {
    if (!Array.isArray(input)) return [];
    const unique = new Set<string>();
    for (const raw of input) {
        const value = String(raw || "").trim().replace(/\s+/g, " ");
        if (!value) continue;
        unique.add(value);
    }
    return Array.from(unique);
};

const resolveSelectOptionName = (propertyDef: any, preferred: string) => {
    const options = propertyDef?.select?.options || [];
    if (!Array.isArray(options) || options.length === 0) return preferred;

    const exact = options.find((opt: any) => opt?.name === preferred);
    if (exact?.name) return exact.name;

    const lower = options.find((opt: any) => String(opt?.name || "").toLowerCase() === preferred.toLowerCase());
    if (lower?.name) return lower.name;

    return preferred;
};

const applyUserIdsProperty = (
    payload: Record<string, any>,
    propertyName: string,
    propertyDef: any,
    userIds: string[],
    userPageIds: string[]
) => {
    if (!propertyDef) return;

    if (propertyDef.type === "relation" && userPageIds.length > 0) {
        payload[propertyName] = {
            relation: userPageIds.map((id) => ({ id })),
        };
        return;
    }

    if (propertyDef.type === "rich_text") {
        payload[propertyName] = {
            rich_text: [{ text: { content: userIds.join(",") } }],
        };
        return;
    }

    if (propertyDef.type === "multi_select") {
        payload[propertyName] = {
            multi_select: userIds.map((id) => ({ name: id })),
        };
    }
};

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

    if (isSupabaseBackend()) {
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

    const schema = await getDatabaseSchema(DB_TEAMS, { forceRefresh: true });
    const titlePropertyName = getTitlePropertyName(schema);
    const teamProps = (schema.properties || {}) as Record<string, any>;
    const keys = resolveTeamPropertyKeys(teamProps);
    const properties: Record<string, any> = {};

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

    if (normalizedName) {
        properties[titlePropertyName] = { title: [{ text: { content: normalizedName } }] };
        if (keys.name && keys.name !== titlePropertyName && teamProps[keys.name]?.type === "rich_text") {
            properties[keys.name] = { rich_text: [{ text: { content: normalizedName } }] };
        }
    }

    if (normalizedDescription !== undefined && keys.description) {
        if (teamProps[keys.description]?.type === "rich_text") {
            properties[keys.description] = normalizedDescription
                ? { rich_text: [{ text: { content: normalizedDescription } }] }
                : { rich_text: [] };
        }
    }

    if (normalizedVisibility && keys.visibility) {
        if (teamProps[keys.visibility]?.type === "select") {
            properties[keys.visibility] = { select: { name: resolveSelectOptionName(teamProps[keys.visibility], normalizedVisibility) } };
        } else if (teamProps[keys.visibility]?.type === "status") {
            properties[keys.visibility] = { status: { name: normalizedVisibility } };
        }
    }

    if (normalizedRoles !== undefined && keys.recruitingRoles) {
        if (teamProps[keys.recruitingRoles]?.type === "multi_select") {
            properties[keys.recruitingRoles] = { multi_select: normalizedRoles.map((role) => ({ name: role })) };
        } else if (teamProps[keys.recruitingRoles]?.type === "rich_text") {
            properties[keys.recruitingRoles] = normalizedRoles.length
                ? { rich_text: [{ text: { content: normalizedRoles.join(", ") } }] }
                : { rich_text: [] };
        }
    }

    if (normalizedLanguage !== undefined && keys.language) {
        if (teamProps[keys.language]?.type === "select") {
            properties[keys.language] = normalizedLanguage
                ? { select: { name: resolveSelectOptionName(teamProps[keys.language], normalizedLanguage) } }
                : { select: null };
        } else if (teamProps[keys.language]?.type === "rich_text") {
            properties[keys.language] = normalizedLanguage
                ? { rich_text: [{ text: { content: normalizedLanguage } }] }
                : { rich_text: [] };
        }
    }

    if (normalizedStage && keys.stage) {
        if (teamProps[keys.stage]?.type === "select") {
            properties[keys.stage] = { select: { name: resolveSelectOptionName(teamProps[keys.stage], normalizedStage) } };
        } else if (teamProps[keys.stage]?.type === "status") {
            properties[keys.stage] = { status: { name: normalizedStage } };
        } else if (teamProps[keys.stage]?.type === "rich_text") {
            properties[keys.stage] = { rich_text: [{ text: { content: normalizedStage } }] };
        }
    }

    if (normalizedTimezone !== undefined && keys.timezone) {
        if (teamProps[keys.timezone]?.type === "select") {
            properties[keys.timezone] = normalizedTimezone
                ? { select: { name: resolveSelectOptionName(teamProps[keys.timezone], normalizedTimezone) } }
                : { select: null };
        } else if (teamProps[keys.timezone]?.type === "rich_text") {
            properties[keys.timezone] = normalizedTimezone
                ? { rich_text: [{ text: { content: normalizedTimezone } }] }
                : { rich_text: [] };
        }
    }

    if (normalizedTeamSize !== undefined && keys.teamSize) {
        if (teamProps[keys.teamSize]?.type === "number") {
            properties[keys.teamSize] = { number: normalizedTeamSize };
        } else if (teamProps[keys.teamSize]?.type === "rich_text") {
            properties[keys.teamSize] = { rich_text: [{ text: { content: String(normalizedTeamSize) } }] };
        }
    }

    if (normalizedOpenSlots !== undefined && keys.openSlots) {
        if (teamProps[keys.openSlots]?.type === "number") {
            properties[keys.openSlots] = { number: normalizedOpenSlots };
        } else if (teamProps[keys.openSlots]?.type === "rich_text") {
            properties[keys.openSlots] = { rich_text: [{ text: { content: String(normalizedOpenSlots) } }] };
        }
    }

    if (normalizedCommitment !== undefined && keys.commitmentHoursPerWeek) {
        if (teamProps[keys.commitmentHoursPerWeek]?.type === "select") {
            properties[keys.commitmentHoursPerWeek] = {
                select: { name: resolveSelectOptionName(teamProps[keys.commitmentHoursPerWeek], normalizedCommitment) },
            };
        } else if (teamProps[keys.commitmentHoursPerWeek]?.type === "rich_text") {
            properties[keys.commitmentHoursPerWeek] = { rich_text: [{ text: { content: normalizedCommitment } }] };
        }
    }

    if (normalizedWorkStyle !== undefined && keys.workStyle) {
        if (teamProps[keys.workStyle]?.type === "select") {
            properties[keys.workStyle] = { select: { name: resolveSelectOptionName(teamProps[keys.workStyle], normalizedWorkStyle) } };
        } else if (teamProps[keys.workStyle]?.type === "status") {
            properties[keys.workStyle] = { status: { name: normalizedWorkStyle } };
        } else if (teamProps[keys.workStyle]?.type === "rich_text") {
            properties[keys.workStyle] = { rich_text: [{ text: { content: normalizedWorkStyle } }] };
        }
    }

    if (Object.keys(properties).length === 0) {
        const mappedKeys = Object.entries(keys)
            .filter(([, value]) => Boolean(value))
            .map(([field, value]) => `${field}:${value}`)
            .join(", ");
        const schemaKeys = Object.keys(teamProps).join(", ");
        throw new Error(
            `No editable fields were mapped to Teams DB properties. mapped=[${mappedKeys}] schema=[${schemaKeys}]`
        );
    }

    await notion.pages.update({
        page_id: existingTeam.id,
        properties,
    });

    const updatedPage = await notion.pages.retrieve(existingTeam.id);
    return mapPageToTeam(updatedPage);
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
    if (isSupabaseBackend()) {
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

    const teamId = uuidv4();
    const schema = await getDatabaseSchema(DB_TEAMS, { forceRefresh: true });
    const titlePropertyName = getTitlePropertyName(schema);
    const teamProps = (schema.properties || {}) as Record<string, any>;
    const keys = resolveTeamPropertyKeys(teamProps);
    const owner = await getUserByUserId(data.ownerId);
    const ownerPageIds = owner?.id ? [owner.id] : [];

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

    const properties: Record<string, any> = {
        [titlePropertyName]: { title: [{ text: { content: data.name } }] },
    };

    if (keys.name && keys.name !== titlePropertyName) {
        const namePropDef = teamProps[keys.name];
        if (namePropDef?.type === "rich_text") {
            properties[keys.name] = { rich_text: [{ text: { content: data.name } }] };
        }
    }

    if (keys.teamId) {
        const teamIdPropDef = teamProps[keys.teamId];
        if (teamIdPropDef?.type === "rich_text") {
            properties[keys.teamId] = { rich_text: [{ text: { content: teamId } }] };
        } else if (teamIdPropDef?.type === "title") {
            properties[keys.teamId] = { title: [{ text: { content: teamId } }] };
        }
    }

    if (keys.visibility && teamProps[keys.visibility]?.type === "select") {
        properties[keys.visibility] = {
            select: { name: resolveSelectOptionName(teamProps[keys.visibility], visibility) },
        };
    } else if (keys.visibility && teamProps[keys.visibility]?.type === "status") {
        properties[keys.visibility] = { status: { name: visibility } };
    }

    if (keys.primaryOwnerUserId && teamProps[keys.primaryOwnerUserId]?.type === "relation" && ownerPageIds.length > 0) {
        properties[keys.primaryOwnerUserId] = { relation: ownerPageIds.map((id) => ({ id })) };
    } else if (keys.primaryOwnerUserId && teamProps[keys.primaryOwnerUserId]?.type === "rich_text") {
        properties[keys.primaryOwnerUserId] = { rich_text: [{ text: { content: data.ownerId } }] };
    }

    if (keys.createdAt && teamProps[keys.createdAt]?.type === "date") {
        properties[keys.createdAt] = { date: { start: new Date().toISOString() } };
    }

    if (description && keys.description && teamProps[keys.description]?.type === "rich_text") {
        properties[keys.description] = { rich_text: [{ text: { content: description } }] };
    }

    if (recruitingRoles.length > 0) {
        if (keys.recruitingRoles && teamProps[keys.recruitingRoles]?.type === "multi_select") {
            properties[keys.recruitingRoles] = {
                multi_select: recruitingRoles.map((role) => ({ name: role })),
            };
        } else if (keys.recruitingRoles && teamProps[keys.recruitingRoles]?.type === "rich_text") {
            properties[keys.recruitingRoles] = {
                rich_text: [{ text: { content: recruitingRoles.join(", ") } }],
            };
        }
    }

    if (language) {
        if (keys.language && teamProps[keys.language]?.type === "select") {
            properties[keys.language] = { select: { name: resolveSelectOptionName(teamProps[keys.language], language) } };
        } else if (keys.language && teamProps[keys.language]?.type === "rich_text") {
            properties[keys.language] = { rich_text: [{ text: { content: language } }] };
        }
    }

    if (keys.stage && teamProps[keys.stage]?.type === "select") {
        properties[keys.stage] = { select: { name: resolveSelectOptionName(teamProps[keys.stage], stage) } };
    } else if (keys.stage && teamProps[keys.stage]?.type === "status") {
        properties[keys.stage] = { status: { name: stage } };
    } else if (keys.stage && teamProps[keys.stage]?.type === "rich_text") {
        properties[keys.stage] = { rich_text: [{ text: { content: stage } }] };
    }

    if (timezone) {
        if (keys.timezone && teamProps[keys.timezone]?.type === "select") {
            properties[keys.timezone] = { select: { name: resolveSelectOptionName(teamProps[keys.timezone], timezone) } };
        } else if (keys.timezone && teamProps[keys.timezone]?.type === "rich_text") {
            properties[keys.timezone] = { rich_text: [{ text: { content: timezone } }] };
        }
    }

    if (keys.teamSize && teamProps[keys.teamSize]?.type === "number") {
        properties[keys.teamSize] = { number: teamSize };
    } else if (keys.teamSize && teamProps[keys.teamSize]?.type === "rich_text") {
        properties[keys.teamSize] = { rich_text: [{ text: { content: String(teamSize) } }] };
    }

    if (keys.openSlots && teamProps[keys.openSlots]?.type === "number") {
        properties[keys.openSlots] = { number: openSlots };
    } else if (keys.openSlots && teamProps[keys.openSlots]?.type === "rich_text") {
        properties[keys.openSlots] = { rich_text: [{ text: { content: String(openSlots) } }] };
    }

    if (commitmentHoursPerWeek) {
        if (keys.commitmentHoursPerWeek && teamProps[keys.commitmentHoursPerWeek]?.type === "select") {
            properties[keys.commitmentHoursPerWeek] = {
                select: { name: resolveSelectOptionName(teamProps[keys.commitmentHoursPerWeek], commitmentHoursPerWeek) },
            };
        } else if (keys.commitmentHoursPerWeek && teamProps[keys.commitmentHoursPerWeek]?.type === "rich_text") {
            properties[keys.commitmentHoursPerWeek] = { rich_text: [{ text: { content: commitmentHoursPerWeek } }] };
        }
    }

    if (keys.workStyle && teamProps[keys.workStyle]?.type === "select") {
        properties[keys.workStyle] = {
            select: { name: resolveSelectOptionName(teamProps[keys.workStyle], workStyle) },
        };
    } else if (keys.workStyle && teamProps[keys.workStyle]?.type === "status") {
        properties[keys.workStyle] = { status: { name: workStyle } };
    } else if (keys.workStyle && teamProps[keys.workStyle]?.type === "rich_text") {
        properties[keys.workStyle] = { rich_text: [{ text: { content: workStyle } }] };
    }

    if (keys.ownersUserIds) {
        applyUserIdsProperty(properties, keys.ownersUserIds, teamProps[keys.ownersUserIds], [data.ownerId], ownerPageIds);
    }
    if (keys.membersUserIds) {
        applyUserIdsProperty(properties, keys.membersUserIds, teamProps[keys.membersUserIds], [data.ownerId], ownerPageIds);
    }

    // 1. Create Team
    await notion.pages.create({
        parent: { database_id: DB_TEAMS },
        properties,
    });

    // 2. Add Owner to TeamMembers
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

    if (isSupabaseBackend()) {
        await supabaseRest(
            `/teams?team_id=eq.${encodeURIComponent(normalizedTeamId)}`,
            {
                method: "DELETE",
                prefer: "return=minimal",
            }
        );
        return;
    }

    const targetTeam = await getTeamById(normalizedTeamId);
    if (targetTeam?.id) {
        await notion.pages.update({
            page_id: targetTeam.id,
            archived: true,
        });
    }

    const memberRows = await notion.databases.query({
        database_id: DB_MEMBERS,
        filter: {
            property: "team_id",
            rich_text: { equals: normalizedTeamId },
        },
        page_size: 100,
    });

    await Promise.all(
        (memberRows.results as any[]).map((page) =>
            notion.pages.update({
                page_id: page.id,
                archived: true,
            })
        )
    );
}

export async function addMemberToTeam(teamId: string, userId: string, role: "Owner" | "Admin" | "Member" = "Member") {
    if (isSupabaseBackend()) {
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

    const buildSelectOrStatusPayload = (property: any, name: string) => {
        if (property?.type === "status") {
            return { status: { name } };
        }
        return { select: { name } };
    };

    // Check if exists first
    const existing = await notion.databases.query({
        database_id: DB_MEMBERS,
        filter: {
            and: [
                { property: "team_id", rich_text: { equals: teamId } },
                { property: "user_id", rich_text: { equals: userId } }
            ]
        }
    });

    const existingPage = (existing.results as any[])[0];
    if (existingPage) {
        const currentStatus = getSelectValue(existingPage.properties?.status);
        const currentRole = normalizeMemberRole(getSelectValue(existingPage.properties?.role));
        const desiredRole = normalizeMemberRole(role);
        const properties: Record<string, any> = {};

        if (!isActiveMemberStatus(currentStatus)) {
            properties.status = buildSelectOrStatusPayload(existingPage.properties?.status, "Active");
        }

        if (roleRank(desiredRole) > roleRank(currentRole)) {
            properties.role = buildSelectOrStatusPayload(existingPage.properties?.role, desiredRole);
        }

        if (Object.keys(properties).length > 0) {
            await notion.pages.update({
                page_id: existingPage.id,
                properties,
            });
        }
        return;
    }

    const membersSchema = await notion.databases.retrieve(DB_MEMBERS).catch(() => null as any);
    const memberProps = (membersSchema?.properties || {}) as Record<string, any>;

    await notion.pages.create({
        parent: { database_id: DB_MEMBERS },
        properties: {
            team_id: { rich_text: [{ text: { content: teamId } }] },
            user_id: { rich_text: [{ text: { content: userId } }] },
            role: buildSelectOrStatusPayload(memberProps.role, normalizeMemberRole(role)),
            status: buildSelectOrStatusPayload(memberProps.status, "Active"),
            joined_at: { date: { start: new Date().toISOString() } }
        }
    });
}

export async function updateTeamMemberRole(
    teamId: string,
    userId: string,
    role: "Admin" | "Member"
) {
    const desiredRole = normalizeMemberRole(role);
    if (desiredRole === "Owner") return;

    if (isSupabaseBackend()) {
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

    const existing = await notion.databases.query({
        database_id: DB_MEMBERS,
        filter: {
            and: [
                { property: "team_id", rich_text: { equals: teamId } },
                { property: "user_id", rich_text: { equals: userId } }
            ]
        },
        page_size: 1,
    });

    const existingPage = (existing.results as any[])[0];
    if (!existingPage) return;

    const buildSelectOrStatusPayload = (property: any, name: string) => {
        if (property?.type === "status") {
            return { status: { name } };
        }
        return { select: { name } };
    };

    await notion.pages.update({
        page_id: existingPage.id,
        properties: {
            role: buildSelectOrStatusPayload(existingPage.properties?.role, desiredRole),
        },
    });
}

export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
    if (isSupabaseBackend()) {
        const ownerRows = (await supabaseRest(
            `/teams?select=primary_owner_user_id&team_id=eq.${encodeURIComponent(teamId)}&limit=1`
        )) as Array<{ primary_owner_user_id?: string | null }>;
        const primaryOwnerUserId = String(ownerRows[0]?.primary_owner_user_id || "").trim() || null;
        const rows = (await supabaseRest(
            `/team_members?select=*&team_id=eq.${encodeURIComponent(teamId)}&order=joined_at.asc`
        )) as SupabaseTeamMemberRow[];
        return rows.map((row) => mapSupabaseTeamMemberRow(row, primaryOwnerUserId));
    }

    const team = await getTeamById(teamId);
    const primaryOwnerUserId = team?.primaryOwnerUserId || "";
    const response = await notion.databases.query({
        database_id: DB_MEMBERS,
        filter: {
            property: "team_id",
            rich_text: { equals: teamId }
        }
    });

    return response.results.map((page: any) => ({
        id: page.id,
        teamId: getTextValue(page.properties.team_id),
        userId: getTextValue(page.properties.user_id),
        role:
            getTextValue(page.properties.user_id) === primaryOwnerUserId
                ? "Owner"
                : normalizeMemberRole(getSelectValue(page.properties.role)),
        status: normalizeMemberStatus(getSelectValue(page.properties.status)),
        joinedAt: page.properties.joined_at?.date?.start || "",
    }));
}

export async function getTeamsForUser(userId: string): Promise<Team[]> {
    if (isSupabaseBackend()) {
        const memberships = (await supabaseRest(
            `/team_members?select=team_id&user_id=eq.${encodeURIComponent(userId)}`
        )) as Array<{ team_id: string }>;
        const teamIds = Array.from(new Set(memberships.map((row) => row.team_id).filter(Boolean)));
        if (!teamIds.length) return [];

        const teams = await Promise.all(teamIds.map((teamId) => getTeamById(teamId)));
        return teams.filter((team): team is Team => Boolean(team));
    }

    const membershipRes = await notion.databases.query({
        database_id: DB_MEMBERS,
        filter: {
            property: "user_id",
            rich_text: { equals: userId }
        }
    });

    const teamIds = Array.from(
        new Set(
            (membershipRes.results as any[])
                .map((page: any) => getTextValue(page.properties.team_id))
                .filter((teamId): teamId is string => typeof teamId === "string" && teamId.length > 0)
        )
    ) as string[];

    const teams = await Promise.all(teamIds.map((teamId: string) => getTeamById(teamId)));
    return teams.filter((team): team is Team => Boolean(team));
}

export async function getTeamMembershipsForUser(userId: string): Promise<TeamMembershipSummary[]> {
    if (isSupabaseBackend()) {
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

    const membershipRes = await notion.databases.query({
        database_id: DB_MEMBERS,
        filter: {
            property: "user_id",
            rich_text: { equals: userId }
        }
    });

    const memberships = (membershipRes.results as any[]).map((page) => ({
        teamId: getTextValue(page.properties.team_id),
        userId,
        role: normalizeMemberRole(getSelectValue(page.properties.role)),
        status: normalizeMemberStatus(getSelectValue(page.properties.status)),
        joinedAt: page.properties.joined_at?.date?.start || "",
    }));

    const validMemberships = memberships.filter(
        (membership): membership is typeof membership & { teamId: string } =>
            typeof membership.teamId === "string" && membership.teamId.length > 0
    );
    const teams = await Promise.all(validMemberships.map((membership) => getTeamById(membership.teamId)));

    return validMemberships.map((membership, index) => {
        const team = teams[index];
        return {
            teamId: membership.teamId,
            teamName: team?.name || membership.teamId,
            role:
                team?.primaryOwnerUserId && membership.userId === team.primaryOwnerUserId
                    ? "Owner"
                    : membership.role,
            status: membership.status,
            joinedAt: membership.joinedAt,
            visibility: team?.visibility || "Private",
        };
    });
}
