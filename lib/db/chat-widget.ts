import { notion, getDatabaseId, getTextValue } from "@/lib/notion-client";
import { listUsers } from "@/lib/db/users";
import { getTeamById, getTeamsForUser } from "@/lib/db/teams";
import { getAcceptedChatPartnerIds } from "@/lib/db/requests";
import { isSupabaseBackend } from "@/lib/db/backend";
import { supabaseRest } from "@/lib/supabase-rest";
import { v4 as uuidv4 } from "uuid";

const DB_THREAD_ID = getDatabaseId(["NOTION_DB_THREADS", "NOTION_DB_CHAT_THREADS"]);
const DB_MESSAGE_ID = getDatabaseId(["NOTION_DB_MESSAGES", "NOTION_DB_CHAT_MESSAGES"]);

interface NotionPropertyDef {
    type: string;
    select?: { options?: Array<{ name: string }> };
}

interface NotionSchema {
    properties: Record<string, NotionPropertyDef>;
}

export interface ChatUserSummary {
    id: string;
    userId: string;
    username: string;
    language?: string;
    skills?: string[];
}

export interface ChatTeamSummary {
    id: string;
    teamId: string;
    name: string;
    visibility?: string;
}

export interface ChatThreadSummary {
    id: string;
    threadId: string;
    type: "dm" | "team";
    title: string;
    participantsUserIds: string[];
    dmSeenMap?: Record<string, number>;
    teamId?: string;
    createdAt?: string;
    lastMessageAt?: string;
}

export interface DmReadReceiptSummary {
    threadId: string;
    available: boolean;
    otherUserId?: string;
    otherSeenAt?: number;
}

export interface ChatMessageSummary {
    id: string;
    messageId: string;
    threadId: string;
    senderId: string;
    senderUsername?: string;
    bodyOriginal: string;
    bodyTranslated?: string;
    translatedLang?: string;
    createdAt: string;
}

interface SupabaseThreadRow {
    thread_id: string;
    type: string;
    title: string | null;
    team_id: string | null;
    participants_user_ids: string[] | null;
    dm_seen_map: Record<string, number> | null;
    created_at: string | null;
    last_message_at: string | null;
}

interface SupabaseMessageRow {
    message_id: string;
    thread_id: string;
    sender_user_id: string;
    body_original: string;
    body_translated: string | null;
    translated_lang: string | null;
    created_at: string;
}

function mapSupabaseThreadRow(row: SupabaseThreadRow): ChatThreadSummary {
    const type = String(row.type || "").toLowerCase() === "team" ? "team" : "dm";
    const participantsFromKey = parseDmParticipantsFromThreadKey(row.thread_id);
    const participants = Array.isArray(row.participants_user_ids)
        ? row.participants_user_ids.filter(Boolean)
        : participantsFromKey;
    return {
        id: row.thread_id,
        threadId: row.thread_id,
        type,
        title: row.title || (type === "team" ? `Team: ${row.team_id || ""}` : "Chat"),
        participantsUserIds: participants,
        dmSeenMap: row.dm_seen_map || {},
        teamId: row.team_id || undefined,
        createdAt: row.created_at || undefined,
        lastMessageAt: row.last_message_at || row.created_at || undefined,
    };
}

function mapSupabaseMessageRow(
    row: SupabaseMessageRow,
    usernameByUserId: Map<string, string>
): ChatMessageSummary {
    const senderUsername = usernameByUserId.get(row.sender_user_id) || "";
    return {
        id: row.message_id,
        messageId: row.message_id,
        threadId: row.thread_id,
        senderId: row.sender_user_id,
        senderUsername: senderUsername || undefined,
        bodyOriginal: row.body_original,
        bodyTranslated: row.body_translated || undefined,
        translatedLang: row.translated_lang || undefined,
        createdAt: row.created_at,
    };
}

let threadSchemaCache: NotionSchema | null = null;
let messageSchemaCache: NotionSchema | null = null;

const findKey = (props: Record<string, NotionPropertyDef>, candidates: string[]) => {
    return candidates.find((key) => Boolean(props[key])) || null;
};

const findTitleKey = (props: Record<string, NotionPropertyDef>) => {
    for (const key of Object.keys(props)) {
        if (props[key].type === "title") return key;
    }
    return null;
};

const readTextByKey = (properties: Record<string, any>, key: string | null) => {
    if (!key) return "";
    return getTextValue(properties[key]);
};

const readTitleText = (properties: Record<string, any>) => {
    for (const key of Object.keys(properties || {})) {
        if (properties[key]?.type === "title") {
            return getTextValue(properties[key]);
        }
    }
    return (
        getTextValue(properties?.Name) ||
        getTextValue(properties?.name) ||
        getTextValue(properties?.title)
    );
};

const parseSeenMap = (raw: string): Record<string, number> => {
    if (!raw) return {};

    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (!parsed || typeof parsed !== "object") return {};

        const normalized: Record<string, number> = {};
        for (const [userId, value] of Object.entries(parsed)) {
            const epoch = Number(value);
            if (userId && Number.isFinite(epoch) && epoch > 0) {
                normalized[userId] = epoch;
            }
        }
        return normalized;
    } catch {
        return {};
    }
};

const selectTypeValue = (def: NotionPropertyDef | undefined, target: "dm" | "team") => {
    const desired = target === "dm" ? "DM" : "TEAM";
    if (!def?.select?.options?.length) return desired;
    const options = def.select.options.map((opt) => opt.name);
    const exact = options.find((name) => name === desired);
    if (exact) return exact;
    const lower = options.find((name) => name.toLowerCase() === target);
    if (lower) return lower;
    return options[0];
};

const toDmThreadKey = (currentUserId: string, otherUserId: string) =>
    `dm::${[currentUserId, otherUserId].sort().join("::")}`;

const toTeamThreadKey = (teamId: string) => `team::${teamId}`;

const parseDmParticipantsFromThreadKey = (threadId: string): string[] => {
    const normalized = String(threadId || "").trim();
    if (!normalized.toLowerCase().startsWith("dm::")) return [];
    const parts = normalized
        .split("::")
        .slice(1)
        .map((part) => part.trim())
        .filter(Boolean);
    return Array.from(new Set(parts)).slice(0, 2);
};

const parseTeamIdFromThreadKey = (threadId: string): string => {
    const normalized = String(threadId || "").trim();
    if (!normalized.toLowerCase().startsWith("team::")) return "";
    return normalized.split("::").slice(1).join("::").trim();
};

async function getThreadByThreadIdSupabase(threadId: string): Promise<ChatThreadSummary | null> {
    const rows = (await supabaseRest(
        `/threads?select=*&thread_id=eq.${encodeURIComponent(threadId)}&limit=1`
    )) as SupabaseThreadRow[];
    if (!rows.length) return null;
    return mapSupabaseThreadRow(rows[0]);
}

async function createDmThreadSupabase(currentUserId: string, otherUserId: string): Promise<ChatThreadSummary> {
    const threadId = toDmThreadKey(currentUserId, otherUserId);
    const participants = [currentUserId, otherUserId].sort();
    const nowIso = new Date().toISOString();

    const existing = await getThreadByThreadIdSupabase(threadId);
    if (existing) return existing;

    await supabaseRest("/threads", {
        method: "POST",
        prefer: "return=representation",
        body: {
            thread_id: threadId,
            type: "DM",
            title: `DM: ${participants.join(" & ")}`,
            participants_user_ids: participants,
            dm_seen_map: {},
            created_at: nowIso,
            last_message_at: nowIso,
        },
    });

    const created = await getThreadByThreadIdSupabase(threadId);
    if (!created) {
        throw new Error("Failed to create DM thread.");
    }
    return created;
}

async function createTeamThreadSupabase(teamId: string): Promise<ChatThreadSummary> {
    const threadId = toTeamThreadKey(teamId);
    const nowIso = new Date().toISOString();
    const existing = await getThreadByThreadIdSupabase(threadId);
    if (existing) return existing;

    const team = await getTeamById(teamId);
    const title = team?.name ? `Team: ${team.name}` : `Team: ${teamId}`;
    await supabaseRest("/threads", {
        method: "POST",
        prefer: "return=representation",
        body: {
            thread_id: threadId,
            type: "TEAM",
            title,
            team_id: teamId,
            participants_user_ids: [],
            dm_seen_map: {},
            created_at: nowIso,
            last_message_at: nowIso,
        },
    });

    const created = await getThreadByThreadIdSupabase(threadId);
    if (!created) {
        throw new Error("Failed to create team thread.");
    }
    return created;
}

async function touchThreadLastMessageAtSupabase(threadId: string, timestampIso: string) {
    await supabaseRest(
        `/threads?thread_id=eq.${encodeURIComponent(threadId)}`,
        {
            method: "PATCH",
            prefer: "return=minimal",
            body: { last_message_at: timestampIso },
        }
    );
}

async function getThreadSchema() {
    if (threadSchemaCache) return threadSchemaCache;
    const schema = (await notion.databases.retrieve(DB_THREAD_ID)) as NotionSchema;
    threadSchemaCache = schema;
    return schema;
}

async function getMessageSchema() {
    if (messageSchemaCache) return messageSchemaCache;
    const schema = (await notion.databases.retrieve(DB_MESSAGE_ID)) as NotionSchema;
    messageSchemaCache = schema;
    return schema;
}

function mapThreadPage(page: any): ChatThreadSummary {
    const props = page.properties || {};
    const threadId = getTextValue(props.thread_id) || page.id;
    const participantsText =
        getTextValue(props.participants_user_ids) ||
        getTextValue(props.participants);
    const participantsFromText = participantsText
        .split(",")
        .map((value: string) => value.trim())
        .filter(Boolean);
    const participantsFromThreadKey = parseDmParticipantsFromThreadKey(threadId);
    const participantsUserIds = participantsFromText.length
        ? participantsFromText
        : participantsFromThreadKey;
    const seenMapText =
        getTextValue(props.dm_seen_map) ||
        getTextValue(props.seen_map) ||
        getTextValue(props.read_map);
    const typeName = props.type?.select?.name?.toLowerCase();

    return {
        id: page.id,
        threadId,
        type: typeName === "team" ? "team" : "dm",
        title: readTitleText(props) || "Chat",
        participantsUserIds,
        dmSeenMap: parseSeenMap(seenMapText),
        teamId: getTextValue(props.team_id) || undefined,
        createdAt: props.created_at?.date?.start || page.created_time,
        lastMessageAt: props.last_message_at?.date?.start || page.last_edited_time || page.created_time,
    };
}

function mapThreadSortValue(thread: ChatThreadSummary) {
    const last = Date.parse(thread.lastMessageAt || "");
    if (Number.isFinite(last)) return last;
    const created = Date.parse(thread.createdAt || "");
    if (Number.isFinite(created)) return created;
    return 0;
}

async function getThreadByThreadId(threadId: string): Promise<ChatThreadSummary | null> {
    const response = await notion.databases.query({
        database_id: DB_THREAD_ID,
        filter: {
            property: "thread_id",
            rich_text: { equals: threadId },
        },
    });

    if (!response.results.length) return null;
    return mapThreadPage(response.results[0]);
}

async function findLegacyDmThread(currentUserId: string, otherUserId: string): Promise<ChatThreadSummary | null> {
    const schema = await getThreadSchema();
    const props = schema.properties || {};
    const typeKey = findKey(props, ["type"]);
    const participantsKey = findKey(props, ["participants_user_ids", "participants"]);

    if (!participantsKey) return null;

    const conditions: any[] = [];
    if (typeKey && props[typeKey].type === "select") {
        conditions.push({
            or: [
                { property: typeKey, select: { equals: "DM" } },
                { property: typeKey, select: { equals: "dm" } },
            ],
        });
    }

    if (props[participantsKey].type === "relation") {
        const users = await listUsers();
        const userPageMap = new Map(users.map((user) => [user.userId, user.id]));
        const currentUserPageId = userPageMap.get(currentUserId);
        const otherUserPageId = userPageMap.get(otherUserId);
        if (!currentUserPageId || !otherUserPageId) return null;

        conditions.push({ property: participantsKey, relation: { contains: currentUserPageId } });
        conditions.push({ property: participantsKey, relation: { contains: otherUserPageId } });
    } else {
        conditions.push({ property: participantsKey, rich_text: { contains: currentUserId } });
        conditions.push({ property: participantsKey, rich_text: { contains: otherUserId } });
    }

    const response = await notion.databases.query({
        database_id: DB_THREAD_ID,
        filter: { and: conditions },
    });

    if (!response.results.length) return null;
    return mapThreadPage(response.results[0]);
}

async function findLegacyTeamThread(teamId: string): Promise<ChatThreadSummary | null> {
    const schema = await getThreadSchema();
    const props = schema.properties || {};
    const typeKey = findKey(props, ["type"]);
    const teamKey = findKey(props, ["team_id", "team"]);
    if (!teamKey) return null;

    const conditions: any[] = [];
    if (typeKey && props[typeKey].type === "select") {
        conditions.push({
            or: [
                { property: typeKey, select: { equals: "TEAM" } },
                { property: typeKey, select: { equals: "team" } },
            ],
        });
    }

    if (props[teamKey].type === "relation") {
        const team = await getTeamById(teamId);
        if (!team) return null;
        conditions.push({ property: teamKey, relation: { contains: team.id } });
    } else {
        conditions.push({ property: teamKey, rich_text: { equals: teamId } });
    }

    const response = await notion.databases.query({
        database_id: DB_THREAD_ID,
        filter: { and: conditions },
    });

    if (!response.results.length) return null;
    return mapThreadPage(response.results[0]);
}

async function createDmThread(currentUserId: string, otherUserId: string): Promise<ChatThreadSummary> {
    const threadId = toDmThreadKey(currentUserId, otherUserId);
    const existing = await getThreadByThreadId(threadId);
    if (existing) return existing;

    const schema = await getThreadSchema();
    const props = schema.properties || {};
    const titleKey = findTitleKey(props);
    const typeKey = findKey(props, ["type"]);
    const threadIdKey = findKey(props, ["thread_id"]);
    const participantsKey = findKey(props, ["participants_user_ids", "participants"]);
    const createdAtKey = findKey(props, ["created_at"]);
    const payload: Record<string, any> = {};
    const nowIso = new Date().toISOString();
    const participants = [currentUserId, otherUserId].sort();

    if (titleKey) {
        payload[titleKey] = {
            title: [{ text: { content: `DM: ${participants.join(" & ")}` } }],
        };
    }
    if (typeKey && props[typeKey].type === "select") {
        payload[typeKey] = { select: { name: selectTypeValue(props[typeKey], "dm") } };
    }
    if (threadIdKey && props[threadIdKey].type === "rich_text") {
        payload[threadIdKey] = { rich_text: [{ text: { content: threadId } }] };
    }
    if (participantsKey) {
        if (props[participantsKey].type === "relation") {
            const users = await listUsers();
            const userPageMap = new Map(users.map((user) => [user.userId, user.id]));
            payload[participantsKey] = {
                relation: participants
                    .map((userId) => userPageMap.get(userId))
                    .filter(Boolean)
                    .map((id) => ({ id })),
            };
        } else {
            payload[participantsKey] = {
                rich_text: [{ text: { content: participants.join(",") } }],
            };
        }
    }
    if (createdAtKey && props[createdAtKey].type === "date") {
        payload[createdAtKey] = { date: { start: nowIso } };
    }

    const page = await notion.pages.create({
        parent: { database_id: DB_THREAD_ID },
        properties: payload,
    });

    const mapped = mapThreadPage(page);
    return {
        ...mapped,
        threadId: mapped.threadId || threadId,
        participantsUserIds: mapped.participantsUserIds.length ? mapped.participantsUserIds : participants,
        title: mapped.title || `DM: ${participants.join(" & ")}`,
    };
}

async function createTeamThread(teamId: string): Promise<ChatThreadSummary> {
    const threadId = toTeamThreadKey(teamId);
    const existing = await getThreadByThreadId(threadId);
    if (existing) return existing;

    const schema = await getThreadSchema();
    const props = schema.properties || {};
    const titleKey = findTitleKey(props);
    const typeKey = findKey(props, ["type"]);
    const threadIdKey = findKey(props, ["thread_id"]);
    const teamKey = findKey(props, ["team_id", "team"]);
    const createdAtKey = findKey(props, ["created_at"]);
    const payload: Record<string, any> = {};
    const nowIso = new Date().toISOString();
    const team = await getTeamById(teamId);
    const threadTitle = team?.name ? `Team: ${team.name}` : `Team: ${teamId}`;

    if (titleKey) {
        payload[titleKey] = { title: [{ text: { content: threadTitle } }] };
    }
    if (typeKey && props[typeKey].type === "select") {
        payload[typeKey] = { select: { name: selectTypeValue(props[typeKey], "team") } };
    }
    if (threadIdKey && props[threadIdKey].type === "rich_text") {
        payload[threadIdKey] = { rich_text: [{ text: { content: threadId } }] };
    }
    if (teamKey) {
        if (props[teamKey].type === "relation" && team?.id) {
            payload[teamKey] = { relation: [{ id: team.id }] };
        } else {
            payload[teamKey] = { rich_text: [{ text: { content: teamId } }] };
        }
    }
    if (createdAtKey && props[createdAtKey].type === "date") {
        payload[createdAtKey] = { date: { start: nowIso } };
    }

    const page = await notion.pages.create({
        parent: { database_id: DB_THREAD_ID },
        properties: payload,
    });

    const mapped = mapThreadPage(page);
    return {
        ...mapped,
        threadId: mapped.threadId || threadId,
        title: mapped.title || threadTitle,
        teamId: mapped.teamId || teamId,
    };
}

async function touchThreadLastMessageAt(threadId: string, timestampIso: string) {
    try {
        const thread = await getThreadByThreadId(threadId);
        if (!thread) return;

        const schema = await getThreadSchema();
        const props = schema.properties || {};
        const lastMessageAtKey = findKey(props, ["last_message_at"]);
        if (!lastMessageAtKey || props[lastMessageAtKey].type !== "date") return;

        await notion.pages.update({
            page_id: thread.id,
            properties: {
                [lastMessageAtKey]: { date: { start: timestampIso } },
            },
        });
    } catch (error) {
        console.error("Failed to update thread last_message_at", error);
    }
}

export async function listDmUsersForChat(currentUserId: string): Promise<ChatUserSummary[]> {
    if (isSupabaseBackend()) {
        const acceptedPartnerIds = new Set(await getAcceptedChatPartnerIds(currentUserId));
        const users = await listUsers();
        return users
            .filter((user) => user.userId && acceptedPartnerIds.has(user.userId))
            .map((user) => ({
                id: user.userId,
                userId: user.userId,
                username: user.username || "Unknown",
                language: user.language || undefined,
                skills: user.skills || [],
            }));
    }

    const acceptedPartnerIds = new Set(await getAcceptedChatPartnerIds(currentUserId));
    const users = await listUsers();
    return users
        .filter((user) => user.userId && acceptedPartnerIds.has(user.userId))
        .map((user) => ({
            id: user.id,
            userId: user.userId,
            username: user.username || "Unknown",
            language: user.language || undefined,
            skills: user.skills || [],
        }));
}

export async function listTeamsForChat(currentUserId: string): Promise<ChatTeamSummary[]> {
    if (isSupabaseBackend()) {
        const teams = await getTeamsForUser(currentUserId);
        return teams.map((team) => ({
            id: team.teamId,
            teamId: team.teamId,
            name: team.name,
            visibility: team.visibility,
        }));
    }

    const teams = await getTeamsForUser(currentUserId);
    return teams.map((team) => ({
        id: team.id,
        teamId: team.teamId,
        name: team.name,
        visibility: team.visibility,
    }));
}

export async function listThreadsForUser(currentUserId: string): Promise<ChatThreadSummary[]> {
    if (!currentUserId) return [];

    if (isSupabaseBackend()) {
        const [dmRows, teams] = await Promise.all([
            supabaseRest("/threads?select=*&type=eq.DM&order=last_message_at.desc") as Promise<SupabaseThreadRow[]>,
            getTeamsForUser(currentUserId),
        ]);

        const teamRowsArrays = await Promise.all(
            teams.map((team) =>
                supabaseRest(
                    `/threads?select=*&type=eq.TEAM&team_id=eq.${encodeURIComponent(team.teamId)}`
                ) as Promise<SupabaseThreadRow[]>
            )
        );
        const teamRows = teamRowsArrays.flat();

        const visibleDmRows = dmRows.filter((row) => {
            const participants = Array.isArray(row.participants_user_ids) ? row.participants_user_ids : [];
            if (participants.includes(currentUserId)) return true;
            return parseDmParticipantsFromThreadKey(row.thread_id).includes(currentUserId);
        });

        const deduped = new Map<string, ChatThreadSummary>();
        for (const row of [...visibleDmRows, ...teamRows]) {
            const mapped = mapSupabaseThreadRow(row);
            const key = mapped.threadId || mapped.id;
            const prev = deduped.get(key);
            if (!prev || mapThreadSortValue(mapped) > mapThreadSortValue(prev)) {
                deduped.set(key, mapped);
            }
        }

        return Array.from(deduped.values()).sort((a, b) => mapThreadSortValue(b) - mapThreadSortValue(a));
    }

    const schema = await getThreadSchema();
    const props = schema.properties || {};
    const typeKey = findKey(props, ["type"]);
    const participantsKey = findKey(props, ["participants_user_ids", "participants"]);
    const teamKey = findKey(props, ["team_id", "team"]);
    const filters: any[] = [];

    if (participantsKey) {
        let participantFilter: any | null = null;

        if (props[participantsKey].type === "relation") {
            const users = await listUsers();
            const me = users.find((user) => user.userId === currentUserId);
            const relationTargetId = me?.id || currentUserId;
            participantFilter = { property: participantsKey, relation: { contains: relationTargetId } };
        } else {
            participantFilter = { property: participantsKey, rich_text: { contains: currentUserId } };
        }

        if (participantFilter) {
            if (typeKey && props[typeKey].type === "select") {
                filters.push({
                    and: [
                        participantFilter,
                        {
                            or: [
                                { property: typeKey, select: { equals: "DM" } },
                                { property: typeKey, select: { equals: "dm" } },
                            ],
                        },
                    ],
                });
            } else {
                filters.push(participantFilter);
            }
        }
    }

    if (teamKey) {
        const teams = await getTeamsForUser(currentUserId);
        if (teams.length) {
            const teamFilters: any[] = [];
            if (props[teamKey].type === "relation") {
                for (const team of teams) {
                    if (!team.id) continue;
                    teamFilters.push({ property: teamKey, relation: { contains: team.id } });
                }
            } else {
                for (const team of teams) {
                    if (!team.teamId) continue;
                    teamFilters.push({ property: teamKey, rich_text: { equals: team.teamId } });
                }
            }

            if (teamFilters.length) {
                const teamMembershipFilter = teamFilters.length === 1 ? teamFilters[0] : { or: teamFilters };
                if (typeKey && props[typeKey].type === "select") {
                    filters.push({
                        and: [
                            teamMembershipFilter,
                            {
                                or: [
                                    { property: typeKey, select: { equals: "TEAM" } },
                                    { property: typeKey, select: { equals: "team" } },
                                ],
                            },
                        ],
                    });
                } else {
                    filters.push(teamMembershipFilter);
                }
            }
        }
    }

    if (!filters.length) return [];

    const response = await notion.databases.query({
        database_id: DB_THREAD_ID,
        filter: filters.length === 1 ? filters[0] : { or: filters },
        sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
    });

    const deduped = new Map<string, ChatThreadSummary>();
    for (const page of response.results) {
        const mapped = mapThreadPage(page);
        const key = mapped.threadId || mapped.id;
        if (!key) continue;
        const prev = deduped.get(key);
        if (!prev || mapThreadSortValue(mapped) > mapThreadSortValue(prev)) {
            deduped.set(key, mapped);
        }
    }

    return Array.from(deduped.values()).sort((a, b) => mapThreadSortValue(b) - mapThreadSortValue(a));
}

export async function getOrCreateDmThread(currentUserId: string, otherUserId: string) {
    if (!otherUserId || currentUserId === otherUserId) {
        throw new Error("Invalid DM target user.");
    }

    if (isSupabaseBackend()) {
        const key = toDmThreadKey(currentUserId, otherUserId);
        const byKey = await getThreadByThreadIdSupabase(key);
        if (byKey) return byKey;
        return createDmThreadSupabase(currentUserId, otherUserId);
    }

    const key = toDmThreadKey(currentUserId, otherUserId);
    const byKey = await getThreadByThreadId(key);
    if (byKey) return byKey;

    const legacy = await findLegacyDmThread(currentUserId, otherUserId);
    if (legacy) return legacy;

    return createDmThread(currentUserId, otherUserId);
}

export async function getOrCreateTeamThread(teamId: string) {
    if (!teamId) {
        throw new Error("Missing teamId.");
    }

    if (isSupabaseBackend()) {
        const key = toTeamThreadKey(teamId);
        const byKey = await getThreadByThreadIdSupabase(key);
        if (byKey) return byKey;
        return createTeamThreadSupabase(teamId);
    }

    const key = toTeamThreadKey(teamId);
    const byKey = await getThreadByThreadId(key);
    if (byKey) return byKey;

    const legacy = await findLegacyTeamThread(teamId);
    if (legacy) return legacy;

    return createTeamThread(teamId);
}

export async function assertThreadAccessForUser(
    threadId: string,
    currentUserId: string
): Promise<ChatThreadSummary> {
    const normalizedThreadId = String(threadId || "").trim();
    const normalizedUserId = String(currentUserId || "").trim();
    if (!normalizedThreadId || !normalizedUserId) {
        throw new Error("Invalid thread access request.");
    }

    const thread = isSupabaseBackend()
        ? await getThreadByThreadIdSupabase(normalizedThreadId)
        : await getThreadByThreadId(normalizedThreadId);
    if (!thread) {
        throw new Error("Thread not found.");
    }

    if (thread.type === "dm") {
        const participants = thread.participantsUserIds.length
            ? thread.participantsUserIds
            : parseDmParticipantsFromThreadKey(thread.threadId);
        const seenMapUsers = Object.keys(thread.dmSeenMap || {});
        const knownUsers = Array.from(new Set([...participants, ...seenMapUsers].filter(Boolean)));
        if (!knownUsers.length || !knownUsers.includes(normalizedUserId)) {
            throw new Error("Forbidden");
        }
        return thread;
    }

    const teamId = String(thread.teamId || "").trim() || parseTeamIdFromThreadKey(thread.threadId);
    if (!teamId) {
        throw new Error("Forbidden");
    }

    const teams = await getTeamsForUser(normalizedUserId);
    const isMember = teams.some((team) => team.teamId === teamId);
    if (!isMember) {
        throw new Error("Forbidden");
    }

    return thread;
}

export async function getDmReadReceiptForUser(threadId: string, currentUserId: string): Promise<DmReadReceiptSummary> {
    if (isSupabaseBackend()) {
        const thread = await getThreadByThreadIdSupabase(threadId);
        if (!thread || thread.type !== "dm") {
            return { threadId, available: false };
        }

        const participantsUserIds = thread.participantsUserIds.length
            ? thread.participantsUserIds
            : parseDmParticipantsFromThreadKey(thread.threadId);
        const seenMap = thread.dmSeenMap || {};
        const isParticipantKnown = participantsUserIds.length > 0;
        const isParticipant = participantsUserIds.includes(currentUserId) || Boolean(seenMap[currentUserId]);

        if (isParticipantKnown && !isParticipant) {
            throw new Error("Forbidden");
        }

        const otherUserId = participantsUserIds.find((userId) => userId !== currentUserId)
            || Object.keys(seenMap).find((userId) => userId !== currentUserId);
        if (!otherUserId) {
            return { threadId, available: false };
        }

        return {
            threadId,
            available: true,
            otherUserId,
            otherSeenAt: seenMap[otherUserId] || 0,
        };
    }

    const thread = await getThreadByThreadId(threadId);
    if (!thread || thread.type !== "dm") {
        return { threadId, available: false };
    }

    const participantsUserIds = thread.participantsUserIds.length
        ? thread.participantsUserIds
        : parseDmParticipantsFromThreadKey(thread.threadId);
    const seenMap = thread.dmSeenMap || {};
    const isParticipantKnown = participantsUserIds.length > 0;
    const isParticipant = participantsUserIds.includes(currentUserId) || Boolean(seenMap[currentUserId]);

    if (isParticipantKnown && !isParticipant) {
        throw new Error("Forbidden");
    }

    const otherUserId = participantsUserIds.find((userId) => userId !== currentUserId)
        || Object.keys(seenMap).find((userId) => userId !== currentUserId);
    if (!otherUserId) {
        return { threadId, available: false };
    }

    return {
        threadId,
        available: true,
        otherUserId,
        otherSeenAt: seenMap[otherUserId] || 0,
    };
}

export async function markDmThreadSeenByUser(
    threadId: string,
    currentUserId: string,
    seenAtEpoch: number = Date.now()
): Promise<DmReadReceiptSummary> {
    if (isSupabaseBackend()) {
        const thread = await getThreadByThreadIdSupabase(threadId);
        if (!thread || thread.type !== "dm") {
            return { threadId, available: false };
        }

        const participantsUserIds = thread.participantsUserIds.length
            ? thread.participantsUserIds
            : parseDmParticipantsFromThreadKey(thread.threadId);
        const currentSeenMap = thread.dmSeenMap || {};
        const isParticipantKnown = participantsUserIds.length > 0;
        const isParticipant = participantsUserIds.includes(currentUserId) || Boolean(currentSeenMap[currentUserId]);

        if (isParticipantKnown && !isParticipant) {
            throw new Error("Forbidden");
        }

        const mergedMap = {
            ...currentSeenMap,
            [currentUserId]: Number.isFinite(seenAtEpoch) ? seenAtEpoch : Date.now(),
        };

        await supabaseRest(
            `/threads?thread_id=eq.${encodeURIComponent(threadId)}`,
            {
                method: "PATCH",
                prefer: "return=minimal",
                body: { dm_seen_map: mergedMap },
            }
        );

        return getDmReadReceiptForUser(threadId, currentUserId);
    }

    const thread = await getThreadByThreadId(threadId);
    if (!thread || thread.type !== "dm") {
        return { threadId, available: false };
    }

    const participantsUserIds = thread.participantsUserIds.length
        ? thread.participantsUserIds
        : parseDmParticipantsFromThreadKey(thread.threadId);
    const currentSeenMap = thread.dmSeenMap || {};
    const isParticipantKnown = participantsUserIds.length > 0;
    const isParticipant = participantsUserIds.includes(currentUserId) || Boolean(currentSeenMap[currentUserId]);

    if (isParticipantKnown && !isParticipant) {
        throw new Error("Forbidden");
    }

    const schema = await getThreadSchema();
    const props = schema.properties || {};
    const seenMapKey = findKey(props, ["dm_seen_map", "seen_map", "read_map"]);
    const seenMapDef = seenMapKey ? props[seenMapKey] : null;

    if (!seenMapKey || !seenMapDef || !["rich_text", "title"].includes(seenMapDef.type)) {
        return getDmReadReceiptForUser(threadId, currentUserId);
    }

    const mergedMap = {
        ...currentSeenMap,
        [currentUserId]: Number.isFinite(seenAtEpoch) ? seenAtEpoch : Date.now(),
    };
    const serialized = JSON.stringify(mergedMap);

    if (seenMapDef.type === "title") {
        await notion.pages.update({
            page_id: thread.id,
            properties: {
                [seenMapKey]: {
                    title: [{ text: { content: serialized } }],
                },
            },
        });
    } else {
        await notion.pages.update({
            page_id: thread.id,
            properties: {
                [seenMapKey]: {
                    rich_text: [{ text: { content: serialized } }],
                },
            },
        });
    }

    return getDmReadReceiptForUser(threadId, currentUserId);
}

export async function listMessagesForThread(
    threadId: string,
    currentUserId: string
): Promise<ChatMessageSummary[]> {
    const normalizedThreadId = String(threadId || "").trim();
    const normalizedUserId = String(currentUserId || "").trim();
    if (!normalizedThreadId || !normalizedUserId) return [];
    await assertThreadAccessForUser(normalizedThreadId, normalizedUserId);

    if (isSupabaseBackend()) {
        const [rows, users] = await Promise.all([
            supabaseRest(
                `/messages?select=*&thread_id=eq.${encodeURIComponent(normalizedThreadId)}&order=created_at.asc`
            ) as Promise<SupabaseMessageRow[]>,
            listUsers(),
        ]);

        const usernameByUserId = new Map(users.map((user) => [user.userId, user.username || ""]));
        return rows.map((row) => mapSupabaseMessageRow(row, usernameByUserId));
    }

    const schema = await getMessageSchema();
    const props = schema.properties || {};
    const threadKey = findKey(props, ["thread_id", "thread"]);
    const senderKey = findKey(props, ["sender_user_id", "sender"]);
    const bodyOriginalKey = findKey(props, ["body_original", "body", "content"]);
    const bodyTranslatedKey = findKey(props, ["body_translated"]);
    const translatedLangKey = findKey(props, ["translated_lang", "lang_target"]);
    const messageIdKey = findKey(props, ["message_id"]);
    const createdAtKey = findKey(props, ["created_at"]);
    if (!threadKey || !bodyOriginalKey) return [];

    let filter: any;
    if (props[threadKey].type === "relation") {
        const thread = await getThreadByThreadId(normalizedThreadId);
        if (!thread) return [];
        filter = { property: threadKey, relation: { contains: thread.id } };
    } else {
        filter = { property: threadKey, rich_text: { equals: normalizedThreadId } };
    }

    const userIdByPageId = new Map<string, string>();
    const usernameByUserId = new Map<string, string>();
    if (senderKey) {
        const users = await listUsers();
        for (const user of users) {
            userIdByPageId.set(user.id, user.userId);
            usernameByUserId.set(user.userId, user.username || "");
        }
    }

    const response = await notion.databases.query({
        database_id: DB_MESSAGE_ID,
        filter,
        sorts: [{ timestamp: "created_time", direction: "ascending" }],
    });

    return response.results.map((page: any) => {
        const messageProps = page.properties || {};
        let senderId = "";
        if (senderKey) {
            if (props[senderKey].type === "relation") {
                const senderPageId = messageProps[senderKey]?.relation?.[0]?.id || "";
                senderId = userIdByPageId.get(senderPageId) || senderPageId;
            } else {
                senderId = getTextValue(messageProps[senderKey]);
            }
        }
        const senderUsername = senderId ? usernameByUserId.get(senderId) || "" : "";

        return {
            id: page.id,
            messageId: readTextByKey(messageProps, messageIdKey) || page.id,
            threadId: normalizedThreadId,
            senderId,
            senderUsername: senderUsername || undefined,
            bodyOriginal: getTextValue(messageProps[bodyOriginalKey]),
            bodyTranslated: readTextByKey(messageProps, bodyTranslatedKey) || undefined,
            translatedLang: readTextByKey(messageProps, translatedLangKey) || undefined,
            createdAt: messageProps[createdAtKey || ""]?.date?.start || page.created_time,
        };
    });
}

export async function createMessageForThread(
    threadId: string,
    senderUserId: string,
    bodyOriginal: string
): Promise<ChatMessageSummary> {
    const normalizedThreadId = String(threadId || "").trim();
    const normalizedSenderUserId = String(senderUserId || "").trim();
    const normalizedBody = String(bodyOriginal || "");

    if (!normalizedBody.trim()) {
        throw new Error("Message cannot be empty.");
    }
    if (!normalizedThreadId || !normalizedSenderUserId) {
        throw new Error("threadId and senderUserId are required.");
    }

    const thread = await assertThreadAccessForUser(normalizedThreadId, normalizedSenderUserId);

    if (isSupabaseBackend()) {
        const users = await listUsers();
        const sender = users.find((user) => user.userId === normalizedSenderUserId);
        const nowIso = new Date().toISOString();
        const messageId = uuidv4();

        await supabaseRest("/messages", {
            method: "POST",
            prefer: "return=minimal",
            body: {
                message_id: messageId,
                thread_id: normalizedThreadId,
                sender_user_id: normalizedSenderUserId,
                body_original: normalizedBody,
                created_at: nowIso,
            },
        });

        await touchThreadLastMessageAtSupabase(normalizedThreadId, nowIso);

        return {
            id: messageId,
            messageId,
            threadId: normalizedThreadId,
            senderId: normalizedSenderUserId,
            senderUsername: sender?.username || undefined,
            bodyOriginal: normalizedBody,
            createdAt: nowIso,
        };
    }

    const schema = await getMessageSchema();
    const props = schema.properties || {};
    const threadKey = findKey(props, ["thread_id", "thread"]);
    const senderKey = findKey(props, ["sender_user_id", "sender"]);
    const bodyOriginalKey = findKey(props, ["body_original", "body", "content"]);
    const messageIdKey = findKey(props, ["message_id"]);
    const createdAtKey = findKey(props, ["created_at"]);
    if (!threadKey || !bodyOriginalKey) {
        throw new Error("Messages DB is missing required thread/body fields.");
    }

    const users = await listUsers();
    const sender = users.find((user) => user.userId === normalizedSenderUserId);
    const nowIso = new Date().toISOString();
    const messageId = uuidv4();

    const payload: Record<string, any> = {};
    if (messageIdKey && props[messageIdKey].type === "rich_text") {
        payload[messageIdKey] = { rich_text: [{ text: { content: messageId } }] };
    }

    if (props[threadKey].type === "relation") {
        payload[threadKey] = { relation: [{ id: thread.id }] };
    } else {
        payload[threadKey] = { rich_text: [{ text: { content: normalizedThreadId } }] };
    }

    if (senderKey) {
        if (props[senderKey].type === "relation" && sender?.id) {
            payload[senderKey] = { relation: [{ id: sender.id }] };
        } else if (props[senderKey].type === "rich_text") {
            payload[senderKey] = { rich_text: [{ text: { content: normalizedSenderUserId } }] };
        }
    }

    if (props[bodyOriginalKey].type === "title") {
        payload[bodyOriginalKey] = { title: [{ text: { content: normalizedBody } }] };
    } else {
        payload[bodyOriginalKey] = { rich_text: [{ text: { content: normalizedBody } }] };
    }

    if (createdAtKey && props[createdAtKey].type === "date") {
        payload[createdAtKey] = { date: { start: nowIso } };
    }

    const page = await notion.pages.create({
        parent: { database_id: DB_MESSAGE_ID },
        properties: payload,
    });

    await touchThreadLastMessageAt(normalizedThreadId, nowIso);

    return {
        id: page.id,
        messageId,
        threadId: normalizedThreadId,
        senderId: normalizedSenderUserId,
        senderUsername: sender?.username || undefined,
        bodyOriginal: normalizedBody,
        createdAt: nowIso,
    };
}
