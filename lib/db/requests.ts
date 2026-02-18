import { notion, getDatabaseId, getTextValue } from "@/lib/notion-client";
import { isSupabaseBackend } from "@/lib/db/backend";
import { supabaseRest } from "@/lib/supabase-rest";
import { getSignedUrlFromStoragePointer, parseSupabaseStoragePointer } from "@/lib/supabase-storage";
import { v4 as uuidv4 } from "uuid";

export type RequestStatus = "PENDING" | "ACCEPTED" | "DECLINED";
type RequestType = "CHAT" | "INVITE" | "JOIN" | "FILE";

const DB_CHAT_REQ = getDatabaseId("NOTION_DB_CHAT_REQUESTS");
const DB_TEAM_INVITE = getDatabaseId("NOTION_DB_TEAM_INVITES");
const DB_JOIN_REQ = getDatabaseId(["NOTION_DB_TEAM_JOIN_REQUESTS", "NOTION_DB_JOIN_REQUESTS"]);
const DB_FILE_REQ = getDatabaseId(["NOTION_DB_FILE_REQUESTS", "NOTION_DB_WORKSPACE_FILE_REQUESTS"]);
const DB_TEAM_MEMBERS = getDatabaseId("NOTION_DB_TEAM_MEMBERS");
const DB_WORKSPACE_FILES = getDatabaseId("NOTION_DB_FILES");
const ACTIVE_BLOCKING_STATUSES: RequestStatus[] = ["PENDING", "ACCEPTED"];
const DB_BY_REQUEST_TYPE: Record<RequestType, string> = {
    CHAT: DB_CHAT_REQ,
    INVITE: DB_TEAM_INVITE,
    JOIN: DB_JOIN_REQ,
    FILE: DB_FILE_REQ,
};

interface SupabaseChatRequestRow {
    request_id: string;
    from_user_id: string;
    to_user_id: string;
    message: string | null;
    status: string;
    created_at: string;
}

interface SupabaseTeamInviteRow {
    invite_id: string;
    team_id: string;
    inviter_user_id: string;
    invitee_user_id: string;
    message: string | null;
    status: string;
    created_at: string;
}

interface SupabaseJoinRequestRow {
    join_request_id: string;
    team_id: string;
    applicant_user_id: string;
    answer_1: string | null;
    answer_2: string | null;
    status: string;
    created_at: string;
}

interface SupabaseTeamMemberRoleRow {
    id?: string;
    team_id: string;
    user_id: string;
    role: string;
    status?: string | null;
}

interface SupabaseWorkspaceFileRow {
    file_id: string;
    team_id: string;
    title: string;
    url: string | null;
}

interface SupabaseFileRequestRow {
    request_id: string;
    team_id: string;
    file_id: string;
    file_name: string;
    file_url: string | null;
    from_user_id: string;
    to_user_id: string;
    message: string | null;
    status: string;
    created_at: string;
}

export class RequestConflictError extends Error {
    requestType: RequestType;
    constructor(message: string, requestType: RequestType) {
        super(message);
        this.name = "RequestConflictError";
        this.requestType = requestType;
    }
}

export interface RequestItem {
    id: string;
    requestId: string;
    type: "CHAT" | "INVITE" | "JOIN" | "FILE";
    fromId: string;
    toId: string;
    teamId?: string;
    fileId?: string;
    fileName?: string;
    fileUrl?: string;
    status: RequestStatus;
    message?: string;
    answers?: { a1: string; a2: string };
    createdAt: string;
}

export interface RequestUpdateContext {
    type: "CHAT" | "INVITE" | "JOIN" | "FILE";
    pageId: string;
    teamId?: string;
    userId?: string;
    fromId?: string;
    toId?: string;
}

export type FileShareDownloadInfo =
    | {
        kind: "file";
        url: string;
        fileName: string;
    }
    | {
        kind: "folder";
        fileName: string;
        entries: Array<{ name: string; url: string }>;
    };

function normalizeStatusName(value: string | null | undefined): RequestStatus | null {
    if (!value) return null;
    const upper = value.trim().toUpperCase();
    if (upper === "PENDING") return "PENDING";
    if (upper === "ACCEPTED") return "ACCEPTED";
    if (upper === "DECLINED" || upper === "REJECTED") return "DECLINED";
    return null;
}

function readStatus(property: any): RequestStatus | null {
    const raw =
        property?.select?.name ||
        property?.status?.name ||
        getTextValue(property) ||
        null;
    return normalizeStatusName(raw);
}

function readStatusFromProperties(properties: Record<string, any> | undefined): RequestStatus | null {
    if (!properties) return null;

    // Fast path for the canonical key.
    const direct = readStatus(properties.status);
    if (direct) return direct;

    // Fallback for schema variants like Status/request_status.
    for (const [key, value] of Object.entries(properties)) {
        const lower = key.toLowerCase();
        if (!lower.includes("status")) continue;
        const parsed = readStatus(value);
        if (parsed) return parsed;
    }

    return null;
}

function normalizeRequestMessage(input: string | undefined | null, fallback: string) {
    const cleaned = (input || "").trim().replace(/\s+/g, " ");
    return (cleaned || fallback).slice(0, 160);
}

function readMessageFromProperties(properties: Record<string, any> | undefined) {
    if (!properties) return "";
    return (
        getTextValue(properties.message) ||
        getTextValue(properties.request_message) ||
        getTextValue(properties.note) ||
        ""
    );
}

async function isUserAlreadyInTeam(teamId: string, userId: string): Promise<boolean> {
    const normalizedTeamId = String(teamId || "").trim();
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedTeamId || !normalizedUserId) return false;

    if (isSupabaseBackend()) {
        const rows = (await supabaseRest(
            `/team_members?select=id&team_id=eq.${encodeURIComponent(normalizedTeamId)}&user_id=eq.${encodeURIComponent(
                normalizedUserId
            )}&limit=1`
        )) as Array<{ id?: string }>;
        return rows.length > 0;
    }

    const response = await notion.databases.query({
        database_id: DB_TEAM_MEMBERS,
        filter: {
            and: [
                { property: "team_id", rich_text: { equals: normalizedTeamId } },
                { property: "user_id", rich_text: { equals: normalizedUserId } },
            ],
        },
        page_size: 1,
    });

    return (response.results as any[]).length > 0;
}

function asRequestItem(
    page: any,
    type: "CHAT" | "INVITE" | "JOIN" | "FILE",
    extras: Partial<RequestItem> = {}
): RequestItem | null {
    const status = readStatusFromProperties(page?.properties);
    if (!status) return null;

    const base: RequestItem = {
        id: page.id,
        requestId: "",
        type,
        fromId: "",
        toId: "",
        status,
        createdAt: page.properties?.created_at?.date?.start || page.created_time,
    };
    return { ...base, ...extras };
}

function mapSupabaseChatRequest(row: SupabaseChatRequestRow): RequestItem {
    return {
        id: row.request_id,
        requestId: row.request_id,
        type: "CHAT",
        fromId: row.from_user_id,
        toId: row.to_user_id,
        status: normalizeStatusName(row.status) || "PENDING",
        message: row.message || "",
        createdAt: row.created_at,
    };
}

function mapSupabaseTeamInvite(row: SupabaseTeamInviteRow): RequestItem {
    return {
        id: row.invite_id,
        requestId: row.invite_id,
        type: "INVITE",
        fromId: row.inviter_user_id,
        toId: row.invitee_user_id,
        teamId: row.team_id,
        status: normalizeStatusName(row.status) || "PENDING",
        message: row.message || "",
        createdAt: row.created_at,
    };
}

function mapSupabaseJoinRequest(row: SupabaseJoinRequestRow): RequestItem {
    return {
        id: row.join_request_id,
        requestId: row.join_request_id,
        type: "JOIN",
        fromId: row.applicant_user_id,
        toId: row.team_id,
        teamId: row.team_id,
        status: normalizeStatusName(row.status) || "PENDING",
        answers: {
            a1: row.answer_1 || "",
            a2: row.answer_2 || "",
        },
        createdAt: row.created_at,
    };
}

function mapSupabaseFileRequest(row: SupabaseFileRequestRow): RequestItem {
    return {
        id: row.request_id,
        requestId: row.request_id,
        type: "FILE",
        fromId: row.from_user_id,
        toId: row.to_user_id,
        teamId: row.team_id,
        fileId: row.file_id,
        fileName: row.file_name || "",
        fileUrl: row.file_url || "",
        status: normalizeStatusName(row.status) || "PENDING",
        message: row.message || "",
        createdAt: row.created_at,
    };
}

// --- CHAT REQUESTS ---
export async function createChatRequest(fromUserId: string, toUserId: string, message: string) {
    if (isSupabaseBackend()) {
        const [directRows, reverseRows] = await Promise.all([
            supabaseRest(
                `/chat_requests?select=*&from_user_id=eq.${encodeURIComponent(fromUserId)}&to_user_id=eq.${encodeURIComponent(toUserId)}`
            ) as Promise<SupabaseChatRequestRow[]>,
            supabaseRest(
                `/chat_requests?select=*&from_user_id=eq.${encodeURIComponent(toUserId)}&to_user_id=eq.${encodeURIComponent(fromUserId)}`
            ) as Promise<SupabaseChatRequestRow[]>,
        ]);

        const duplicated = [...directRows, ...reverseRows].some((row) => {
            const normalized = normalizeStatusName(row.status);
            return !normalized || ACTIVE_BLOCKING_STATUSES.includes(normalized);
        });
        if (duplicated) {
            throw new RequestConflictError("A chat request already exists for this user.", "CHAT");
        }

        const messageText = normalizeRequestMessage(message, "Let's chat!");
        await supabaseRest("/chat_requests", {
            method: "POST",
            prefer: "return=minimal",
            body: {
                request_id: uuidv4(),
                from_user_id: fromUserId,
                to_user_id: toUserId,
                message: messageText,
                status: "PENDING",
            },
        });
        return;
    }

    const existing = await notion.databases.query({
        database_id: DB_CHAT_REQ,
        filter: {
            and: [
                {
                    or: [
                        { property: "from_user_id", rich_text: { equals: fromUserId } },
                        { property: "to_user_id", rich_text: { equals: fromUserId } }
                    ]
                },
                {
                    or: [
                        { property: "from_user_id", rich_text: { equals: toUserId } },
                        { property: "to_user_id", rich_text: { equals: toUserId } }
                    ]
                }
            ]
        }
    });

    const duplicated = (existing.results as any[]).some((page) => {
        const status = readStatusFromProperties(page?.properties);
        // Unknown status is treated as active to avoid duplicate request storms.
        return !status || ACTIVE_BLOCKING_STATUSES.includes(status);
    });
    if (duplicated) {
        throw new RequestConflictError("A chat request already exists for this user.", "CHAT");
    }

    const statusProperty = (existing.results as any[])[0]?.properties?.status;
    const pendingStatusPayload =
        statusProperty?.type === "status"
            ? { status: { name: "PENDING" } }
            : { select: { name: "PENDING" } };
    const messageText = normalizeRequestMessage(message, "Let's chat!");

    const id = uuidv4();
    await notion.pages.create({
        parent: { database_id: DB_CHAT_REQ },
        properties: {
            chat_request_id: { rich_text: [{ text: { content: id } }] },
            from_user_id: { rich_text: [{ text: { content: fromUserId } }] },
            to_user_id: { rich_text: [{ text: { content: toUserId } }] },
            message: { rich_text: [{ text: { content: messageText } }] },
            status: pendingStatusPayload,
            created_at: { date: { start: new Date().toISOString() } }
        }
    });
}

export async function getChatRequestsForUserByStatuses(userId: string, statuses: RequestStatus[]): Promise<RequestItem[]> {
    if (isSupabaseBackend()) {
        const rows = (await supabaseRest(
            `/chat_requests?select=*&to_user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`
        )) as SupabaseChatRequestRow[];
        return rows
            .map(mapSupabaseChatRequest)
            .filter((item) => statuses.includes(item.status));
    }

    const response = await notion.databases.query({
        database_id: DB_CHAT_REQ,
        filter: {
            property: "to_user_id",
            rich_text: { equals: userId }
        }
    });

    return (response.results as any[])
        .map((p) =>
            asRequestItem(p, "CHAT", {
                requestId: getTextValue(p.properties.chat_request_id),
                fromId: getTextValue(p.properties.from_user_id),
                toId: getTextValue(p.properties.to_user_id),
                message: readMessageFromProperties(p.properties),
            })
        )
        .filter((item): item is RequestItem => {
            if (!item) return false;
            return statuses.includes(item.status);
        });
}

export async function getChatRequestsForUser(userId: string): Promise<RequestItem[]> {
    return getChatRequestsForUserByStatuses(userId, ["PENDING"]);
}

export async function getAcceptedChatPartnerIds(userId: string): Promise<string[]> {
    if (isSupabaseBackend()) {
        const [fromRows, toRows] = await Promise.all([
            supabaseRest(
                `/chat_requests?select=from_user_id,to_user_id,status&from_user_id=eq.${encodeURIComponent(userId)}`
            ) as Promise<SupabaseChatRequestRow[]>,
            supabaseRest(
                `/chat_requests?select=from_user_id,to_user_id,status&to_user_id=eq.${encodeURIComponent(userId)}`
            ) as Promise<SupabaseChatRequestRow[]>,
        ]);

        const partnerIds = new Set<string>();
        for (const row of [...fromRows, ...toRows]) {
            if (normalizeStatusName(row.status) !== "ACCEPTED") continue;
            if (row.from_user_id === userId && row.to_user_id) partnerIds.add(row.to_user_id);
            if (row.to_user_id === userId && row.from_user_id) partnerIds.add(row.from_user_id);
        }
        return Array.from(partnerIds);
    }

    const response = await notion.databases.query({
        database_id: DB_CHAT_REQ,
        filter: {
            or: [
                { property: "from_user_id", rich_text: { equals: userId } },
                { property: "to_user_id", rich_text: { equals: userId } }
            ]
        }
    });

    const partnerIds = new Set<string>();
    for (const page of response.results as any[]) {
        const status = readStatusFromProperties(page?.properties);
        if (status !== "ACCEPTED") continue;

        const fromId = getTextValue(page.properties.from_user_id);
        const toId = getTextValue(page.properties.to_user_id);

        if (fromId === userId && toId) partnerIds.add(toId);
        if (toId === userId && fromId) partnerIds.add(fromId);
    }

    return Array.from(partnerIds);
}

export async function getActiveChatPartnerStates(
    userId: string
): Promise<Record<string, "PENDING" | "ACCEPTED">> {
    if (isSupabaseBackend()) {
        const [fromRows, toRows] = await Promise.all([
            supabaseRest(
                `/chat_requests?select=from_user_id,to_user_id,status&from_user_id=eq.${encodeURIComponent(userId)}`
            ) as Promise<SupabaseChatRequestRow[]>,
            supabaseRest(
                `/chat_requests?select=from_user_id,to_user_id,status&to_user_id=eq.${encodeURIComponent(userId)}`
            ) as Promise<SupabaseChatRequestRow[]>,
        ]);

        const stateByPartnerId: Record<string, "PENDING" | "ACCEPTED"> = {};
        for (const row of [...fromRows, ...toRows]) {
            const status = normalizeStatusName(row.status);
            if (status !== "PENDING" && status !== "ACCEPTED") continue;
            const partnerId =
                row.from_user_id === userId
                    ? row.to_user_id
                    : row.to_user_id === userId
                      ? row.from_user_id
                      : "";
            if (!partnerId) continue;

            const current = stateByPartnerId[partnerId];
            if (status === "ACCEPTED" || !current) {
                stateByPartnerId[partnerId] = status;
            }
        }

        return stateByPartnerId;
    }

    const response = await notion.databases.query({
        database_id: DB_CHAT_REQ,
        filter: {
            or: [
                { property: "from_user_id", rich_text: { equals: userId } },
                { property: "to_user_id", rich_text: { equals: userId } }
            ]
        }
    });

    const stateByPartnerId: Record<string, "PENDING" | "ACCEPTED"> = {};
    for (const page of response.results as any[]) {
        const fromId = getTextValue(page.properties.from_user_id);
        const toId = getTextValue(page.properties.to_user_id);
        const status = readStatusFromProperties(page?.properties);
        if (status !== "PENDING" && status !== "ACCEPTED") continue;

        const partnerId = fromId === userId ? toId : toId === userId ? fromId : "";
        if (!partnerId) continue;

        const current = stateByPartnerId[partnerId];
        // ACCEPTED takes precedence over PENDING.
        if (status === "ACCEPTED" || !current) {
            stateByPartnerId[partnerId] = status;
        }
    }

    return stateByPartnerId;
}

// --- TEAM INVITES ---
export async function createTeamInvite(teamId: string, inviterId: string, inviteeId: string, message: string) {
    if (await isUserAlreadyInTeam(teamId, inviteeId)) {
        throw new RequestConflictError("This user is already in the same team.", "INVITE");
    }

    if (isSupabaseBackend()) {
        const existing = (await supabaseRest(
            `/team_invites?select=*&team_id=eq.${encodeURIComponent(teamId)}&invitee_user_id=eq.${encodeURIComponent(inviteeId)}`
        )) as SupabaseTeamInviteRow[];

        const duplicated = existing.some((row) => {
            const normalized = normalizeStatusName(row.status);
            return !normalized || ACTIVE_BLOCKING_STATUSES.includes(normalized);
        });
        if (duplicated) {
            throw new RequestConflictError("An active team invite already exists for this user.", "INVITE");
        }

        const messageText = normalizeRequestMessage(message, "I'd like to invite you to my team.");
        await supabaseRest("/team_invites", {
            method: "POST",
            prefer: "return=minimal",
            body: {
                invite_id: uuidv4(),
                team_id: teamId,
                inviter_user_id: inviterId,
                invitee_user_id: inviteeId,
                message: messageText,
                status: "PENDING",
            },
        });
        return;
    }

    const existing = await notion.databases.query({
        database_id: DB_TEAM_INVITE,
        filter: {
            and: [
                { property: "team_id", rich_text: { equals: teamId } },
                { property: "invitee_user_id", rich_text: { equals: inviteeId } }
            ]
        }
    });

    const duplicated = (existing.results as any[]).some((page) => {
        const status = readStatusFromProperties(page?.properties);
        return !status || ACTIVE_BLOCKING_STATUSES.includes(status);
    });
    if (duplicated) {
        throw new RequestConflictError("An active team invite already exists for this user.", "INVITE");
    }

    const statusProperty = (existing.results as any[])[0]?.properties?.status;
    const pendingStatusPayload =
        statusProperty?.type === "status"
            ? { status: { name: "PENDING" } }
            : { select: { name: "PENDING" } };
    const messageText = normalizeRequestMessage(message, "I'd like to invite you to my team.");

    const id = uuidv4();
    await notion.pages.create({
        parent: { database_id: DB_TEAM_INVITE },
        properties: {
            invite_id: { rich_text: [{ text: { content: id } }] },
            team_id: { rich_text: [{ text: { content: teamId } }] },
            inviter_user_id: { rich_text: [{ text: { content: inviterId } }] },
            invitee_user_id: { rich_text: [{ text: { content: inviteeId } }] },
            message: { rich_text: [{ text: { content: messageText } }] },
            status: pendingStatusPayload,
            created_at: { date: { start: new Date().toISOString() } }
        }
    });
}

export async function getTeamInvitesForUserByStatuses(userId: string, statuses: RequestStatus[]): Promise<RequestItem[]> {
    if (isSupabaseBackend()) {
        const rows = (await supabaseRest(
            `/team_invites?select=*&invitee_user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`
        )) as SupabaseTeamInviteRow[];
        return rows
            .map(mapSupabaseTeamInvite)
            .filter((item) => statuses.includes(item.status));
    }

    const response = await notion.databases.query({
        database_id: DB_TEAM_INVITE,
        filter: {
            property: "invitee_user_id",
            rich_text: { equals: userId }
        }
    });

    return (response.results as any[])
        .map((p) =>
            asRequestItem(p, "INVITE", {
                requestId: getTextValue(p.properties.invite_id),
                fromId: getTextValue(p.properties.inviter_user_id),
                toId: getTextValue(p.properties.invitee_user_id),
                teamId: getTextValue(p.properties.team_id),
                message: readMessageFromProperties(p.properties),
            })
        )
        .filter((item): item is RequestItem => {
            if (!item) return false;
            return statuses.includes(item.status);
        });
}

export async function getTeamInvitesForUser(userId: string): Promise<RequestItem[]> {
    return getTeamInvitesForUserByStatuses(userId, ["PENDING"]);
}

// --- JOIN REQUESTS ---
export async function createJoinRequest(teamId: string, applicantId: string, a1: string, a2: string) {
    if (isSupabaseBackend()) {
        const existing = (await supabaseRest(
            `/join_requests?select=*&team_id=eq.${encodeURIComponent(teamId)}&applicant_user_id=eq.${encodeURIComponent(applicantId)}`
        )) as SupabaseJoinRequestRow[];
        const duplicated = existing.some((row) => {
            const normalized = normalizeStatusName(row.status);
            return !normalized || ACTIVE_BLOCKING_STATUSES.includes(normalized);
        });
        if (duplicated) {
            throw new RequestConflictError("A join request is already active for this team.", "JOIN");
        }

        await supabaseRest("/join_requests", {
            method: "POST",
            prefer: "return=minimal",
            body: {
                join_request_id: uuidv4(),
                team_id: teamId,
                applicant_user_id: applicantId,
                answer_1: a1 || "",
                answer_2: a2 || "",
                status: "PENDING",
            },
        });
        return;
    }

    const existing = await notion.databases.query({
        database_id: DB_JOIN_REQ,
        filter: {
            and: [
                { property: "team_id", rich_text: { equals: teamId } },
                { property: "applicant_user_id", rich_text: { equals: applicantId } }
            ]
        }
    });

    const duplicated = (existing.results as any[]).some((page) => {
        const status = readStatusFromProperties(page?.properties);
        return !status || ACTIVE_BLOCKING_STATUSES.includes(status);
    });
    if (duplicated) {
        throw new RequestConflictError("A join request is already active for this team.", "JOIN");
    }

    const statusProperty = (existing.results as any[])[0]?.properties?.status;
    const pendingStatusPayload =
        statusProperty?.type === "status"
            ? { status: { name: "PENDING" } }
            : { select: { name: "PENDING" } };

    const id = uuidv4();
    await notion.pages.create({
        parent: { database_id: DB_JOIN_REQ },
        properties: {
            join_request_id: { rich_text: [{ text: { content: id } }] },
            team_id: { rich_text: [{ text: { content: teamId } }] },
            applicant_user_id: { rich_text: [{ text: { content: applicantId } }] },
            answer_1: { rich_text: [{ text: { content: a1 } }] },
            answer_2: { rich_text: [{ text: { content: a2 } }] },
            status: pendingStatusPayload,
            created_at: { date: { start: new Date().toISOString() } }
        }
    });
}

export async function getJoinRequestsForTeam(teamId: string): Promise<RequestItem[]> {
    if (isSupabaseBackend()) {
        const rows = (await supabaseRest(
            `/join_requests?select=*&team_id=eq.${encodeURIComponent(teamId)}&order=created_at.desc`
        )) as SupabaseJoinRequestRow[];

        return rows
            .map(mapSupabaseJoinRequest)
            .filter((item) => item.status === "PENDING");
    }

    const response = await notion.databases.query({
        database_id: DB_JOIN_REQ,
        filter: {
            property: "team_id",
            rich_text: { equals: teamId }
        }
    });
    return (response.results as any[])
        .map((p) =>
            asRequestItem(p, "JOIN", {
                requestId: getTextValue(p.properties.join_request_id),
                fromId: getTextValue(p.properties.applicant_user_id),
                toId: getTextValue(p.properties.team_id),
                teamId: getTextValue(p.properties.team_id),
                answers: {
                    a1: getTextValue(p.properties.answer_1),
                    a2: getTextValue(p.properties.answer_2)
                },
            })
        )
        .filter((item): item is RequestItem => {
            if (!item) return false;
            return item.status === "PENDING";
        });
}

export async function getJoinApplicationsForManagerByStatuses(
    userId: string,
    statuses: RequestStatus[]
): Promise<RequestItem[]> {
    if (isSupabaseBackend()) {
        const [ownedTeams, memberships] = await Promise.all([
            supabaseRest(
                `/teams?select=team_id&primary_owner_user_id=eq.${encodeURIComponent(userId)}`
            ) as Promise<Array<{ team_id: string }>>,
            supabaseRest(
                `/team_members?select=team_id,user_id,role&user_id=eq.${encodeURIComponent(userId)}`
            ) as Promise<SupabaseTeamMemberRoleRow[]>,
        ]);

        const managedTeamIds = Array.from(
            new Set(
                [
                    ...ownedTeams.map((row) => row.team_id).filter(Boolean),
                    ...memberships
                        .filter((row) => String(row.role || "").trim().toLowerCase() === "owner")
                        .map((row) => row.team_id)
                        .filter(Boolean),
                ]
            )
        );

        if (!managedTeamIds.length) return [];

        const requestRows = await Promise.all(
            managedTeamIds.map((teamId) =>
                supabaseRest(
                    `/join_requests?select=*&team_id=eq.${encodeURIComponent(teamId)}&order=created_at.desc`
                ) as Promise<SupabaseJoinRequestRow[]>
            )
        );

        return requestRows
            .flat()
            .map(mapSupabaseJoinRequest)
            .filter((item) => statuses.includes(item.status));
    }

    const memberships = await notion.databases.query({
        database_id: DB_TEAM_MEMBERS,
        filter: {
            and: [
                { property: "user_id", rich_text: { equals: userId } },
                { property: "role", select: { equals: "Owner" } }
            ]
        }
    });

    const managedTeamIds = Array.from(
        new Set(
            (memberships.results as any[])
                .map((m) => getTextValue(m.properties.team_id))
                .filter(Boolean)
        )
    );

    if (managedTeamIds.length === 0) return [];

    const response = await notion.databases.query({
        database_id: DB_JOIN_REQ,
        filter: {
            or: managedTeamIds.map((teamId) => ({
                property: "team_id",
                rich_text: { equals: teamId }
            }))
        }
    });

    return (response.results as any[])
        .map((p) =>
            asRequestItem(p, "JOIN", {
                requestId: getTextValue(p.properties.join_request_id),
                fromId: getTextValue(p.properties.applicant_user_id),
                toId: getTextValue(p.properties.team_id),
                teamId: getTextValue(p.properties.team_id),
                answers: {
                    a1: getTextValue(p.properties.answer_1),
                    a2: getTextValue(p.properties.answer_2)
                },
            })
        )
        .filter((item): item is RequestItem => {
            if (!item) return false;
            return statuses.includes(item.status);
        });
}

export async function getJoinRequestsForApplicantByStatuses(
    userId: string,
    statuses: RequestStatus[]
): Promise<RequestItem[]> {
    if (isSupabaseBackend()) {
        const rows = (await supabaseRest(
            `/join_requests?select=*&applicant_user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`
        )) as SupabaseJoinRequestRow[];
        return rows
            .map(mapSupabaseJoinRequest)
            .filter((item) => statuses.includes(item.status));
    }

    const response = await notion.databases.query({
        database_id: DB_JOIN_REQ,
        filter: {
            property: "applicant_user_id",
            rich_text: { equals: userId }
        }
    });

    return (response.results as any[])
        .map((p) =>
            asRequestItem(p, "JOIN", {
                requestId: getTextValue(p.properties.join_request_id),
                fromId: getTextValue(p.properties.applicant_user_id),
                toId: getTextValue(p.properties.team_id),
                teamId: getTextValue(p.properties.team_id),
                answers: {
                    a1: getTextValue(p.properties.answer_1),
                    a2: getTextValue(p.properties.answer_2),
                },
            })
        )
        .filter((item): item is RequestItem => {
            if (!item) return false;
            return statuses.includes(item.status);
        });
}

// --- FILE SHARE REQUESTS ---
export async function createFileShareRequest(
    teamId: string,
    fromUserId: string,
    toUserId: string,
    fileId: string,
    fileName: string,
    message: string,
    options?: { allowDuplicate?: boolean }
) {
    const normalizedTeamId = String(teamId || "").trim();
    const normalizedFromUserId = String(fromUserId || "").trim();
    const normalizedToUserId = String(toUserId || "").trim();
    const normalizedFileId = String(fileId || "").trim();
    if (!normalizedTeamId || !normalizedFromUserId || !normalizedToUserId || !normalizedFileId) {
        throw new Error("Missing required metadata for file share request.");
    }
    if (normalizedFromUserId === normalizedToUserId) {
        throw new Error("You cannot send a file to yourself.");
    }

    const allowDuplicate = Boolean(options?.allowDuplicate);

    if (isSupabaseBackend()) {
        const [memberships, files, existing] = await Promise.all([
            supabaseRest(
                `/team_members?select=team_id,user_id,status&team_id=eq.${encodeURIComponent(normalizedTeamId)}`
            ) as Promise<SupabaseTeamMemberRoleRow[]>,
            supabaseRest(
                `/workspace_files?select=file_id,team_id,title,url&team_id=eq.${encodeURIComponent(
                    normalizedTeamId
                )}&file_id=eq.${encodeURIComponent(normalizedFileId)}&limit=1`
            ) as Promise<SupabaseWorkspaceFileRow[]>,
            supabaseRest(
                `/file_share_requests?select=*&team_id=eq.${encodeURIComponent(
                    normalizedTeamId
                )}&from_user_id=eq.${encodeURIComponent(normalizedFromUserId)}&to_user_id=eq.${encodeURIComponent(
                    normalizedToUserId
                )}&file_id=eq.${encodeURIComponent(normalizedFileId)}`
            ) as Promise<SupabaseFileRequestRow[]>,
        ]);

        const memberUserIds = new Set(memberships.map((row) => row.user_id).filter(Boolean));
        if (!memberUserIds.has(normalizedFromUserId) || !memberUserIds.has(normalizedToUserId)) {
            throw new Error("Both users must be members of the same team.");
        }

        const sourceFile = files[0];
        if (!sourceFile) {
            throw new Error("The selected file was not found.");
        }

        const duplicated = existing.some((row) => {
            const normalized = normalizeStatusName(row.status);
            return !normalized || ACTIVE_BLOCKING_STATUSES.includes(normalized);
        });
        if (duplicated && !allowDuplicate) {
            throw new RequestConflictError("An active file request already exists for this file and user.", "FILE");
        }

        const resolvedFileName =
            String(fileName || "").trim().slice(0, 120) ||
            String(sourceFile.title || "").trim().slice(0, 120) ||
            "Shared file";
        const messageText = normalizeRequestMessage(message, `${resolvedFileName} file was shared.`);

        await supabaseRest("/file_share_requests", {
            method: "POST",
            prefer: "return=minimal",
            body: {
                request_id: uuidv4(),
                team_id: normalizedTeamId,
                file_id: normalizedFileId,
                file_name: resolvedFileName,
                file_url: sourceFile.url || "",
                from_user_id: normalizedFromUserId,
                to_user_id: normalizedToUserId,
                message: messageText,
                status: "PENDING",
            },
        });
        return;
    }

    const [sourceFileRows, existingRows] = await Promise.all([
        notion.databases.query({
            database_id: DB_WORKSPACE_FILES,
            filter: {
                and: [
                    { property: "team_id", rich_text: { equals: normalizedTeamId } },
                    { property: "file_id", rich_text: { equals: normalizedFileId } },
                ],
            },
            page_size: 1,
        }),
        notion.databases.query({
            database_id: DB_FILE_REQ,
            filter: {
                and: [
                    { property: "team_id", rich_text: { equals: normalizedTeamId } },
                    { property: "from_user_id", rich_text: { equals: normalizedFromUserId } },
                    { property: "to_user_id", rich_text: { equals: normalizedToUserId } },
                    { property: "file_id", rich_text: { equals: normalizedFileId } },
                ],
            },
        }),
    ]);

    const duplicated = (existingRows.results as any[]).some((page) => {
        const status = readStatusFromProperties(page?.properties);
        return !status || ACTIVE_BLOCKING_STATUSES.includes(status);
    });
    if (duplicated && !allowDuplicate) {
        throw new RequestConflictError("An active file request already exists for this file and user.", "FILE");
    }

    const sourceFile = (sourceFileRows.results as any[])[0];
    if (!sourceFile) {
        throw new Error("The selected file was not found.");
    }

    const resolvedFileName =
        String(fileName || "").trim().slice(0, 120) ||
        String(getTextValue(sourceFile?.properties?.Name || sourceFile?.properties?.title) || "")
            .trim()
            .slice(0, 120) ||
        "Shared file";
    const sourceUrl = String(sourceFile?.properties?.url?.url || "").trim();
    const messageText = normalizeRequestMessage(message, `${resolvedFileName} file was shared.`);

    const id = uuidv4();
    await notion.pages.create({
        parent: { database_id: DB_FILE_REQ },
        properties: {
            request_id: { rich_text: [{ text: { content: id } }] },
            team_id: { rich_text: [{ text: { content: normalizedTeamId } }] },
            file_id: { rich_text: [{ text: { content: normalizedFileId } }] },
            file_name: { rich_text: [{ text: { content: resolvedFileName } }] },
            file_url: sourceUrl ? { url: sourceUrl } : { url: null },
            from_user_id: { rich_text: [{ text: { content: normalizedFromUserId } }] },
            to_user_id: { rich_text: [{ text: { content: normalizedToUserId } }] },
            message: { rich_text: [{ text: { content: messageText } }] },
            status: { select: { name: "PENDING" } },
            created_at: { date: { start: new Date().toISOString() } },
        },
    });
}

export async function getFileShareRequestsForUserByStatuses(
    userId: string,
    statuses: RequestStatus[]
): Promise<RequestItem[]> {
    if (isSupabaseBackend()) {
        const rows = (await supabaseRest(
            `/file_share_requests?select=*&to_user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`
        )) as SupabaseFileRequestRow[];
        return rows
            .map(mapSupabaseFileRequest)
            .filter((item) => statuses.includes(item.status));
    }

    const response = await notion.databases.query({
        database_id: DB_FILE_REQ,
        filter: {
            property: "to_user_id",
            rich_text: { equals: userId },
        },
    });

    return (response.results as any[])
        .map((p) =>
            asRequestItem(p, "FILE", {
                requestId: getTextValue(p.properties.request_id),
                fromId: getTextValue(p.properties.from_user_id),
                toId: getTextValue(p.properties.to_user_id),
                teamId: getTextValue(p.properties.team_id),
                fileId: getTextValue(p.properties.file_id),
                fileName: getTextValue(p.properties.file_name),
                fileUrl: p.properties?.file_url?.url || "",
                message: readMessageFromProperties(p.properties),
            })
        )
        .filter((item): item is RequestItem => {
            if (!item) return false;
            return statuses.includes(item.status);
        });
}

export async function getFileShareDownloadInfoForUser(
    requestId: string,
    userId: string
): Promise<FileShareDownloadInfo | null> {
    const normalizedRequestId = String(requestId || "").trim();
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedRequestId || !normalizedUserId) return null;

    if (isSupabaseBackend()) {
        const rows = (await supabaseRest(
            `/file_share_requests?select=*&request_id=eq.${encodeURIComponent(normalizedRequestId)}&limit=1`
        )) as SupabaseFileRequestRow[];
        const row = rows[0];
        if (!row) return null;
        if (row.to_user_id !== normalizedUserId) {
            throw new Error("Forbidden");
        }
        if (normalizeStatusName(row.status) !== "ACCEPTED") {
            throw new Error("File request is not accepted yet.");
        }

        const fallbackRows = (await supabaseRest(
            `/workspace_files?select=url,title&team_id=eq.${encodeURIComponent(
                row.team_id
            )}&file_id=eq.${encodeURIComponent(row.file_id)}&limit=1`
        )) as Array<{ url: string | null; title: string | null }>;

        const sourceTitle =
            String(fallbackRows[0]?.title || "").trim() ||
            String(row.file_name || "").trim();
        const sourceUrl =
            String(row.file_url || "").trim() ||
            String(fallbackRows[0]?.url || "").trim();
        const isFolder = sourceTitle.startsWith("Folder: ");

        if (isFolder) {
            const folderName = sourceTitle.slice("Folder: ".length).trim() || "folder";
            const children = (await supabaseRest(
                `/workspace_files?select=title,url&team_id=eq.${encodeURIComponent(
                    row.team_id
                )}&folder_id=eq.${encodeURIComponent(row.file_id)}&order=created_at.asc`
            )) as Array<{ title: string | null; url: string | null }>;

            const entries: Array<{ name: string; url: string }> = [];
            for (const child of children) {
                const childTitle = String(child.title || "").trim() || "untitled";
                const childUrl = String(child.url || "").trim();
                if (!childUrl) continue;
                const pointer = parseSupabaseStoragePointer(childUrl);
                const resolvedChildUrl = pointer ? await getSignedUrlFromStoragePointer(childUrl) : childUrl;
                if (!resolvedChildUrl) continue;
                entries.push({ name: childTitle, url: resolvedChildUrl });
            }

            return {
                kind: "folder",
                fileName: `${folderName}.tar`,
                entries,
            };
        }

        if (!sourceUrl) {
            throw new Error("File source is unavailable.");
        }

        const pointer = parseSupabaseStoragePointer(sourceUrl);
        const downloadUrl = pointer ? await getSignedUrlFromStoragePointer(sourceUrl) : sourceUrl;
        if (!downloadUrl) {
            throw new Error("Unable to create file download URL.");
        }

        return {
            kind: "file",
            url: downloadUrl,
            fileName: String(row.file_name || "shared-file").trim() || "shared-file",
        };
    }

    const page = await notion.pages.retrieve(normalizedRequestId).catch(() => null as any);
    if (!page?.id) return null;
    const props = page.properties || {};
    if (getTextValue(props.to_user_id) !== normalizedUserId) {
        throw new Error("Forbidden");
    }
    const status = readStatusFromProperties(props);
    if (status !== "ACCEPTED") {
        throw new Error("File request is not accepted yet.");
    }
    const url = String(props?.file_url?.url || "").trim();
    if (!url) {
        throw new Error("File source is unavailable.");
    }
    return {
        kind: "file",
        url,
        fileName: String(getTextValue(props.file_name) || "shared-file").trim() || "shared-file",
    };
}

export async function syncAcceptedTeamMembershipsForUser(userId: string, onlyTeamId?: string) {
    const [acceptedInvites, acceptedJoins] = await Promise.all([
        getTeamInvitesForUserByStatuses(userId, ["ACCEPTED"]),
        getJoinRequestsForApplicantByStatuses(userId, ["ACCEPTED"]),
    ]);

    const teamIds = Array.from(
        new Set(
            [...acceptedInvites, ...acceptedJoins]
                .map((item) => item.teamId)
                .filter((id): id is string => Boolean(id))
                .filter((id) => !onlyTeamId || id === onlyTeamId)
        )
    );

    if (teamIds.length === 0) return;

    const { addMemberToTeam } = await import("./teams");
    await Promise.all(teamIds.map((teamId) => addMemberToTeam(teamId, userId)));
}

export async function updateRequestStatus(
    _type: "CHAT" | "INVITE" | "JOIN" | "FILE",
    pageId: string,
    status: RequestStatus
): Promise<RequestUpdateContext> {
    const type = _type;

    if (isSupabaseBackend()) {
        if (type === "CHAT") {
            const selected = (await supabaseRest(
                `/chat_requests?select=*&request_id=eq.${encodeURIComponent(pageId)}&limit=1`
            )) as SupabaseChatRequestRow[];
            if (!selected.length) {
                throw new Error("Request not found");
            }
            const current = selected[0];
            const fromId = current.from_user_id;
            const toId = current.to_user_id;

            const [directRows, reverseRows] = await Promise.all([
                supabaseRest(
                    `/chat_requests?select=*&from_user_id=eq.${encodeURIComponent(fromId)}&to_user_id=eq.${encodeURIComponent(toId)}`
                ) as Promise<SupabaseChatRequestRow[]>,
                supabaseRest(
                    `/chat_requests?select=*&from_user_id=eq.${encodeURIComponent(toId)}&to_user_id=eq.${encodeURIComponent(fromId)}`
                ) as Promise<SupabaseChatRequestRow[]>,
            ]);

            const candidateRows = new Map<string, SupabaseChatRequestRow>();
            for (const row of [...directRows, ...reverseRows]) {
                candidateRows.set(row.request_id, row);
            }
            candidateRows.set(current.request_id, current);

            for (const row of candidateRows.values()) {
                const currentStatus = normalizeStatusName(row.status);
                if (row.request_id !== current.request_id && currentStatus !== "PENDING") continue;
                await supabaseRest(
                    `/chat_requests?request_id=eq.${encodeURIComponent(row.request_id)}`,
                    {
                        method: "PATCH",
                        prefer: "return=minimal",
                        body: { status },
                    }
                );
            }

            return {
                type,
                pageId,
                fromId: fromId || undefined,
                toId: toId || undefined,
            };
        }

        if (type === "INVITE") {
            const selected = (await supabaseRest(
                `/team_invites?select=*&invite_id=eq.${encodeURIComponent(pageId)}&limit=1`
            )) as SupabaseTeamInviteRow[];
            if (!selected.length) {
                throw new Error("Request not found");
            }
            const current = selected[0];
            const fromId = current.inviter_user_id;
            const toId = current.invitee_user_id;
            const teamId = current.team_id;

            const siblings = (await supabaseRest(
                `/team_invites?select=*&team_id=eq.${encodeURIComponent(teamId)}&invitee_user_id=eq.${encodeURIComponent(toId)}`
            )) as SupabaseTeamInviteRow[];

            const candidateRows = new Map<string, SupabaseTeamInviteRow>();
            for (const row of siblings) {
                candidateRows.set(row.invite_id, row);
            }
            candidateRows.set(current.invite_id, current);

            for (const row of candidateRows.values()) {
                const currentStatus = normalizeStatusName(row.status);
                if (row.invite_id !== current.invite_id && currentStatus !== "PENDING") continue;
                await supabaseRest(
                    `/team_invites?invite_id=eq.${encodeURIComponent(row.invite_id)}`,
                    {
                        method: "PATCH",
                        prefer: "return=minimal",
                        body: { status },
                    }
                );
            }

            return {
                type,
                pageId,
                teamId: teamId || undefined,
                userId: toId || undefined,
                fromId: fromId || undefined,
                toId: toId || undefined,
            };
        }

        if (type === "FILE") {
            const selected = (await supabaseRest(
                `/file_share_requests?select=*&request_id=eq.${encodeURIComponent(pageId)}&limit=1`
            )) as SupabaseFileRequestRow[];
            if (!selected.length) {
                throw new Error("Request not found");
            }
            const current = selected[0];
            const teamId = current.team_id;
            const fromId = current.from_user_id;
            const toId = current.to_user_id;
            const fileId = current.file_id;

            const siblings = (await supabaseRest(
                `/file_share_requests?select=*&team_id=eq.${encodeURIComponent(
                    teamId
                )}&from_user_id=eq.${encodeURIComponent(fromId)}&to_user_id=eq.${encodeURIComponent(
                    toId
                )}&file_id=eq.${encodeURIComponent(fileId)}`
            )) as SupabaseFileRequestRow[];

            const candidateRows = new Map<string, SupabaseFileRequestRow>();
            for (const row of siblings) {
                candidateRows.set(row.request_id, row);
            }
            candidateRows.set(current.request_id, current);

            for (const row of candidateRows.values()) {
                const currentStatus = normalizeStatusName(row.status);
                if (row.request_id !== current.request_id && currentStatus !== "PENDING") continue;
                await supabaseRest(
                    `/file_share_requests?request_id=eq.${encodeURIComponent(row.request_id)}`,
                    {
                        method: "PATCH",
                        prefer: "return=minimal",
                        body: { status },
                    }
                );
            }

            return {
                type,
                pageId,
                teamId: teamId || undefined,
                fromId: fromId || undefined,
                toId: toId || undefined,
            };
        }

        const selected = (await supabaseRest(
            `/join_requests?select=*&join_request_id=eq.${encodeURIComponent(pageId)}&limit=1`
        )) as SupabaseJoinRequestRow[];
        if (!selected.length) {
            throw new Error("Request not found");
        }
        const current = selected[0];
        const applicantId = current.applicant_user_id;
        const teamId = current.team_id;

        const siblings = (await supabaseRest(
            `/join_requests?select=*&team_id=eq.${encodeURIComponent(teamId)}&applicant_user_id=eq.${encodeURIComponent(applicantId)}`
        )) as SupabaseJoinRequestRow[];

        const candidateRows = new Map<string, SupabaseJoinRequestRow>();
        for (const row of siblings) {
            candidateRows.set(row.join_request_id, row);
        }
        candidateRows.set(current.join_request_id, current);

        for (const row of candidateRows.values()) {
            const currentStatus = normalizeStatusName(row.status);
            if (row.join_request_id !== current.join_request_id && currentStatus !== "PENDING") continue;
            await supabaseRest(
                `/join_requests?join_request_id=eq.${encodeURIComponent(row.join_request_id)}`,
                {
                    method: "PATCH",
                    prefer: "return=minimal",
                    body: { status },
                }
            );
        }

        return {
            type,
            pageId,
            teamId: teamId || undefined,
            userId: applicantId || undefined,
            fromId: applicantId || undefined,
            toId: teamId || undefined,
        };
    }

    const dbId = DB_BY_REQUEST_TYPE[type];
    const page = await notion.pages.retrieve(pageId) as any;
    const props = page.properties || {};
    const fromId = getTextValue(props.from_user_id) || getTextValue(props.inviter_user_id) || getTextValue(props.applicant_user_id);
    const toId = getTextValue(props.to_user_id) || getTextValue(props.invitee_user_id) || getTextValue(props.team_id);
    const teamId = getTextValue(props.team_id) || undefined;
    const userId =
        (type === "INVITE" ? getTextValue(props.invitee_user_id) : "") ||
        (type === "JOIN" ? getTextValue(props.applicant_user_id) : "") ||
        (type === "FILE" ? getTextValue(props.to_user_id) : "") ||
        undefined;

    let siblingPendingFilter: any = null;
    if (type === "CHAT") {
        const fromUserId = getTextValue(props.from_user_id);
        const toUserId = getTextValue(props.to_user_id);
        if (fromUserId && toUserId) {
            siblingPendingFilter = {
                and: [
                    {
                        or: [
                            { property: "from_user_id", rich_text: { equals: fromUserId } },
                            { property: "to_user_id", rich_text: { equals: fromUserId } }
                        ]
                    },
                    {
                        or: [
                            { property: "from_user_id", rich_text: { equals: toUserId } },
                            { property: "to_user_id", rich_text: { equals: toUserId } }
                        ]
                    }
                ]
            };
        }
    } else if (type === "INVITE") {
        const teamId = getTextValue(props.team_id);
        const inviteeUserId = getTextValue(props.invitee_user_id);
        if (teamId && inviteeUserId) {
            siblingPendingFilter = {
                and: [
                    { property: "team_id", rich_text: { equals: teamId } },
                    { property: "invitee_user_id", rich_text: { equals: inviteeUserId } }
                ]
            };
        }
    } else if (type === "JOIN") {
        const teamId = getTextValue(props.team_id);
        const applicantUserId = getTextValue(props.applicant_user_id);
        if (teamId && applicantUserId) {
            siblingPendingFilter = {
                and: [
                    { property: "team_id", rich_text: { equals: teamId } },
                    { property: "applicant_user_id", rich_text: { equals: applicantUserId } }
                ]
            };
        }
    } else if (type === "FILE") {
        const teamId = getTextValue(props.team_id);
        const fromUserId = getTextValue(props.from_user_id);
        const toUserId = getTextValue(props.to_user_id);
        const fileId = getTextValue(props.file_id);
        if (teamId && fromUserId && toUserId && fileId) {
            siblingPendingFilter = {
                and: [
                    { property: "team_id", rich_text: { equals: teamId } },
                    { property: "from_user_id", rich_text: { equals: fromUserId } },
                    { property: "to_user_id", rich_text: { equals: toUserId } },
                    { property: "file_id", rich_text: { equals: fileId } }
                ]
            };
        }
    }

    const candidatePages = new Map<string, any>();
    candidatePages.set(pageId, page);
    if (siblingPendingFilter) {
        const siblings = await notion.databases.query({
            database_id: dbId,
            filter: siblingPendingFilter
        });
        for (const sibling of siblings.results as any[]) {
            candidatePages.set(sibling.id, sibling);
        }
    }

    const buildStatusUpdate = (statusProp: any) => {
        if (statusProp?.type === "status") {
            return { status: { name: status } };
        }
        return { select: { name: status } };
    };

    for (const [id, candidatePage] of candidatePages.entries()) {
        const currentStatus = readStatusFromProperties(candidatePage?.properties);
        if (id !== pageId && currentStatus !== "PENDING") continue;
        await notion.pages.update({
            page_id: id,
            properties: {
                status: buildStatusUpdate(candidatePage?.properties?.status)
            }
        });
    }

    return {
        type,
        pageId,
        teamId,
        userId,
        fromId: fromId || undefined,
        toId: toId || undefined,
    };
}
