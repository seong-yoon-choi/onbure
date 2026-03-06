import { getUserByUserId, listUsers, listUsersByUserIds } from "@/lib/db/users";
import { getTeamById, getTeamsForUser } from "@/lib/db/teams";
import { getAcceptedConnectionPartnerIds } from "@/lib/db/requests";
import { normalizeLanguage } from "@/lib/i18n";
import { translateTextsWithDeepL } from "@/lib/server/deepl";
import { supabaseRest } from "@/lib/supabase-rest";
import { v4 as uuidv4 } from "uuid";



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




const buildSupabaseInClause = (values: string[]) =>
    values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .map((value) => `"${value.replace(/"/g, '\\"')}"`)
        .join(",");

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



function mapThreadSortValue(thread: ChatThreadSummary) {
    const last = Date.parse(thread.lastMessageAt || "");
    if (Number.isFinite(last)) return last;
    const created = Date.parse(thread.createdAt || "");
    if (Number.isFinite(created)) return created;
    return 0;
}



export async function listDmUsersForChat(currentUserId: string): Promise<ChatUserSummary[]> {
    const acceptedPartnerIds = new Set(await getAcceptedConnectionPartnerIds(currentUserId));
    const users = await listUsers();
    return users
        .filter((user) => user && user.userId && acceptedPartnerIds.has(user.userId))
        .map((user) => ({
            id: user.userId,
            userId: user.userId,
            username: user.username || "Unknown",
            language: user.language || undefined,
            skills: user.skills || [],
        }));
}

export async function listTeamsForChat(currentUserId: string): Promise<ChatTeamSummary[]> {
    const teams = await getTeamsForUser(currentUserId);
    return teams.map((team) => ({
        id: team.teamId,
        teamId: team.teamId,
        name: team.name,
        visibility: team.visibility,
    }));
}

export async function listThreadsForUser(currentUserId: string): Promise<ChatThreadSummary[]> {
    if (!currentUserId) return [];

    const [teams, dmRowsRaw] = await Promise.all([
        getTeamsForUser(currentUserId),
        (async () => {
            try {
                const containsValue = encodeURIComponent(`{${currentUserId}}`);
                return (await supabaseRest(
                    `/threads?select=*&type=eq.DM&participants_user_ids=cs.${containsValue}&order=last_message_at.desc`
                )) as SupabaseThreadRow[];
            } catch {
                return (await supabaseRest(
                    "/threads?select=*&type=eq.DM&order=last_message_at.desc"
                )) as SupabaseThreadRow[];
            }
        })(),
    ]);
    const teamIds = teams.map((team) => team.teamId).filter(Boolean);
    let teamRows: SupabaseThreadRow[] = [];
    if (teamIds.length) {
        const inClause = buildSupabaseInClause(teamIds);
        if (inClause) {
            teamRows = (await supabaseRest(
                `/threads?select=*&type=eq.TEAM&team_id=in.(${encodeURIComponent(inClause)})`
            )) as SupabaseThreadRow[];
        }
    }
    const visibleDmRows = dmRowsRaw.filter((row) => {
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

export async function getOrCreateDmThread(currentUserId: string, otherUserId: string) {
    if (!otherUserId || currentUserId === otherUserId) {
        throw new Error("Invalid DM target user.");
    }

    const key = toDmThreadKey(currentUserId, otherUserId);
    const byKey = await getThreadByThreadIdSupabase(key);
    if (byKey) return byKey;

    return createDmThreadSupabase(currentUserId, otherUserId);
}

export async function getOrCreateTeamThread(teamId: string) {
    if (!teamId) {
        throw new Error("Missing teamId.");
    }

    const key = toTeamThreadKey(teamId);
    const byKey = await getThreadByThreadIdSupabase(key);
    if (byKey) return byKey;

    return createTeamThreadSupabase(teamId);
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

    const thread = await getThreadByThreadIdSupabase(normalizedThreadId);
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
        otherSeenAt: seenMap[otherUserId]
    };
}

export async function markDmThreadSeenByUser(
    threadId: string,
    currentUserId: string,
    seenAtEpoch: number = Date.now()
): Promise<DmReadReceiptSummary> {
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

export async function listMessagesForThread(
    threadId: string,
    currentUserId: string,
    options?: {
        includeSenderUsernames?: boolean;
    }
): Promise<ChatMessageSummary[]> {
    const normalizedThreadId = String(threadId || "").trim();
    const normalizedUserId = String(currentUserId || "").trim();
    const includeSenderUsernames = options?.includeSenderUsernames !== false;
    if (!normalizedThreadId || !normalizedUserId) return [];
    await assertThreadAccessForUser(normalizedThreadId, normalizedUserId);

    const rows = (await supabaseRest(
        `/messages?select=*&thread_id=eq.${encodeURIComponent(normalizedThreadId)}&order=created_at.asc`
    )) as SupabaseMessageRow[];
    let usernameByUserId = new Map<string, string>();
    if (includeSenderUsernames) {
        const senderUserIds = Array.from(
            new Set(rows.map((row) => String(row.sender_user_id || "").trim()).filter(Boolean))
        );
        if (senderUserIds.length) {
            const users = await listUsersByUserIds(senderUserIds);
            usernameByUserId = new Map(users.map((user) => [user.userId, user.username || ""]));
        }
    }

    const viewer = await getUserByUserId(normalizedUserId);
    const viewerLanguage = normalizeLanguage(viewer?.language || "ko");
    const textsToTranslate = Array.from(
        new Set(
            rows
                .filter((row) => String(row.sender_user_id || "").trim() !== normalizedUserId)
                .map((row) => String(row.body_original || ""))
                .map((text) => text.trim())
                .filter(Boolean)
        )
    );
    const translatedByOriginal = await translateTextsWithDeepL(textsToTranslate, viewerLanguage);

    return rows.map((row) => {
        const message = mapSupabaseMessageRow(row, usernameByUserId);
        const senderId = String(row.sender_user_id || "").trim();
        const originalBody = String(row.body_original || "");
        if (!originalBody.trim() || senderId === normalizedUserId) {
            return message;
        }

        const storedTargetRaw = String(row.translated_lang || "").trim();
        const storedTarget =
            storedTargetRaw.length > 0 ? normalizeLanguage(storedTargetRaw) : null;
        const storedTranslation = String(row.body_translated || "").trim();
        const translatedBody =
            (storedTarget === viewerLanguage && storedTranslation
                ? storedTranslation
                : translatedByOriginal.get(originalBody.trim()) || "") || "";
        if (!translatedBody || translatedBody === originalBody) {
            return message;
        }

        return {
            ...message,
            bodyTranslated: translatedBody,
            translatedLang: viewerLanguage,
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

    await assertThreadAccessForUser(normalizedThreadId, normalizedSenderUserId);

    const sender = await getUserByUserId(normalizedSenderUserId);
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
