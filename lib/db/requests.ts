import { supabaseRest } from "../supabase-rest";
import { getSignedUrlFromStoragePointer, parseSupabaseStoragePointer } from "../supabase-storage";
import { v4 as uuidv4 } from "uuid";

export type RequestStatus = "PENDING" | "ACCEPTED" | "DECLINED";
type RequestType = "CHAT" | "FRIEND" | "INVITE" | "JOIN" | "FILE";

const ACTIVE_BLOCKING_STATUSES: RequestStatus[] = ["PENDING", "ACCEPTED"];
const PENDING_BLOCKING_STATUSES: RequestStatus[] = ["PENDING"];

interface SupabaseChatRequestRow {
    request_id: string;
    from_user_id: string;
    to_user_id: string;
    message: string | null;
    status: string;
    created_at: string;
}

interface SupabaseFriendRequestRow {
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
    type: "CHAT" | "FRIEND" | "INVITE" | "JOIN" | "FILE";
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
    type: "CHAT" | "FRIEND" | "INVITE" | "JOIN" | "FILE";
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

function normalizeRequestMessage(input: string | undefined | null, fallback: string) {
    const cleaned = (input || "").trim().replace(/\s+/g, " ");
    return (cleaned || fallback).slice(0, 160);
}

async function isUserAlreadyInTeam(teamId: string, userId: string): Promise<boolean> {
    const normalizedTeamId = String(teamId || "").trim();
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedTeamId || !normalizedUserId) return false;

    const rows = (await supabaseRest(
        `/team_members?select=id,status&team_id=eq.${encodeURIComponent(normalizedTeamId)}&user_id=eq.${encodeURIComponent(
            normalizedUserId
        )}`
    )) as Array<{ id?: string; status?: string | null }>;
    return rows.some((row) => String(row.status || "").trim().toLowerCase() !== "inactive");
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

function mapSupabaseFriendRequest(row: SupabaseFriendRequestRow): RequestItem {
    return {
        id: row.request_id,
        requestId: row.request_id,
        type: "FRIEND",
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

function isMissingFriendRequestsTableError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error || "");
    return (
        message.includes("friend_requests") &&
        (message.includes("PGRST") || message.includes("does not exist") || message.includes("schema cache"))
    );
}

// --- FRIEND REQUESTS ---
export async function createFriendRequest(fromUserId: string, toUserId: string, message: string) {
    try {
        const [directRows, reverseRows] = await Promise.all([
            supabaseRest(
                `/friend_requests?select=*&from_user_id=eq.${encodeURIComponent(fromUserId)}&to_user_id=eq.${encodeURIComponent(toUserId)}`
            ) as Promise<SupabaseFriendRequestRow[]>,
            supabaseRest(
                `/friend_requests?select=*&from_user_id=eq.${encodeURIComponent(toUserId)}&to_user_id=eq.${encodeURIComponent(fromUserId)}`
            ) as Promise<SupabaseFriendRequestRow[]>,
        ]);

        const duplicated = [...directRows, ...reverseRows].some((row) => {
            const normalized = normalizeStatusName(row.status);
            return !normalized || ACTIVE_BLOCKING_STATUSES.includes(normalized);
        });
        if (duplicated) {
            throw new RequestConflictError("A friend request already exists for this user.", "FRIEND");
        }

        const messageText = normalizeRequestMessage(message, "Let's be friends.");
        await supabaseRest("/friend_requests", {
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
    } catch (error) {
        if (isMissingFriendRequestsTableError(error)) {
            throw new Error("friend_requests table is missing. Run the latest supabase/schema.sql.");
        }
        throw error;
    }
}

export async function removeFriendship(userId1: string, userId2: string) {
    try {
        const [directRows, reverseRows] = await Promise.all([
            supabaseRest(
                `/friend_requests?select=request_id&from_user_id=eq.${encodeURIComponent(userId1)}&to_user_id=eq.${encodeURIComponent(userId2)}`
            ) as Promise<{ request_id: string }[]>,
            supabaseRest(
                `/friend_requests?select=request_id&from_user_id=eq.${encodeURIComponent(userId2)}&to_user_id=eq.${encodeURIComponent(userId1)}`
            ) as Promise<{ request_id: string }[]>,
        ]);

        const requestIds = [...directRows, ...reverseRows].map(r => r.request_id);

        for (const reqId of requestIds) {
            await supabaseRest(`/friend_requests?request_id=eq.${encodeURIComponent(reqId)}`, {
                method: "DELETE",
                prefer: "return=minimal",
            });
        }
        return true;
    } catch (error) {
        if (isMissingFriendRequestsTableError(error)) {
            throw new Error("friend_requests table is missing. Run the latest supabase/schema.sql.");
        }
        throw error;
    }
}

export async function getFriendRequestsForUserByStatuses(userId: string, statuses: RequestStatus[]): Promise<RequestItem[]> {
    try {
        const rows = (await supabaseRest(
            `/friend_requests?select=*&to_user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`
        )) as SupabaseFriendRequestRow[];
        return rows
            .map(mapSupabaseFriendRequest)
            .filter((item) => statuses.includes(item.status));
    } catch (error) {
        if (isMissingFriendRequestsTableError(error)) return [];
        throw error;
    }
}

export async function getAcceptedFriendPartnerIds(userId: string): Promise<string[]> {
    try {
        const [fromRows, toRows] = await Promise.all([
            supabaseRest(
                `/friend_requests?select=from_user_id,to_user_id,status&from_user_id=eq.${encodeURIComponent(userId)}`
            ) as Promise<SupabaseFriendRequestRow[]>,
            supabaseRest(
                `/friend_requests?select=from_user_id,to_user_id,status&to_user_id=eq.${encodeURIComponent(userId)}`
            ) as Promise<SupabaseFriendRequestRow[]>,
        ]);

        const partnerIds = new Set<string>();
        for (const row of [...fromRows, ...toRows]) {
            if (normalizeStatusName(row.status) !== "ACCEPTED") continue;
            if (row.from_user_id === userId && row.to_user_id) partnerIds.add(row.to_user_id);
            if (row.to_user_id === userId && row.from_user_id) partnerIds.add(row.from_user_id);
        }
        return Array.from(partnerIds);
    } catch (error) {
        if (isMissingFriendRequestsTableError(error)) return [];
        throw error;
    }
}

export async function getActiveFriendPartnerStates(
    userId: string
): Promise<Record<string, "PENDING" | "ACCEPTED">> {
    try {
        const [fromRows, toRows] = await Promise.all([
            supabaseRest(
                `/friend_requests?select=from_user_id,to_user_id,status&from_user_id=eq.${encodeURIComponent(userId)}`
            ) as Promise<SupabaseFriendRequestRow[]>,
            supabaseRest(
                `/friend_requests?select=from_user_id,to_user_id,status&to_user_id=eq.${encodeURIComponent(userId)}`
            ) as Promise<SupabaseFriendRequestRow[]>,
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
                stateByPartnerId[partnerId] = status as "PENDING" | "ACCEPTED";
            }
        }

        return stateByPartnerId;
    } catch (error) {
        if (isMissingFriendRequestsTableError(error)) return {};
        throw error;
    }
}

// --- CHAT REQUESTS ---
export async function createChatRequest(fromUserId: string, toUserId: string, message: string) {
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

export async function getChatRequestsForUserByStatuses(userId: string, statuses: RequestStatus[]): Promise<RequestItem[]> {
    const rows = (await supabaseRest(
        `/chat_requests?select=*&to_user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`
    )) as SupabaseChatRequestRow[];
    return rows
        .map(mapSupabaseChatRequest)
        .filter((item) => statuses.includes(item.status));
}

export async function getChatRequestsForUser(userId: string): Promise<RequestItem[]> {
    return getChatRequestsForUserByStatuses(userId, ["PENDING"]);
}

export async function getAcceptedChatPartnerIds(userId: string): Promise<string[]> {
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

export async function getAcceptedConnectionPartnerIds(userId: string): Promise<string[]> {
    const [chatPartnerIds, friendPartnerIds] = await Promise.all([
        getAcceptedChatPartnerIds(userId),
        getAcceptedFriendPartnerIds(userId),
    ]);
    return Array.from(new Set([...chatPartnerIds, ...friendPartnerIds]));
}

export async function getActiveChatPartnerStates(
    userId: string
): Promise<Record<string, "PENDING" | "ACCEPTED">> {
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
            stateByPartnerId[partnerId] = status as "PENDING" | "ACCEPTED";
        }
    }

    return stateByPartnerId;
}

// --- TEAM INVITES ---
export async function createTeamInvite(teamId: string, inviterId: string, inviteeId: string, message: string) {
    if (await isUserAlreadyInTeam(teamId, inviteeId)) {
        throw new RequestConflictError("This user is already in the same team.", "INVITE");
    }

    const existing = (await supabaseRest(
        `/team_invites?select=*&team_id=eq.${encodeURIComponent(teamId)}&invitee_user_id=eq.${encodeURIComponent(inviteeId)}`
    )) as SupabaseTeamInviteRow[];

    const duplicated = existing.some((row) => {
        const normalized = normalizeStatusName(row.status);
        return !normalized || PENDING_BLOCKING_STATUSES.includes(normalized);
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

export async function getTeamInvitesForUserByStatuses(userId: string, statuses: RequestStatus[]): Promise<RequestItem[]> {
    const rows = (await supabaseRest(
        `/team_invites?select=*&invitee_user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`
    )) as SupabaseTeamInviteRow[];
    return rows
        .map(mapSupabaseTeamInvite)
        .filter((item) => statuses.includes(item.status));
}

export async function getTeamInvitesForUser(userId: string): Promise<RequestItem[]> {
    return getTeamInvitesForUserByStatuses(userId, ["PENDING"]);
}

// --- JOIN REQUESTS ---
export async function createJoinRequest(teamId: string, applicantId: string, a1: string, a2: string) {
    if (await isUserAlreadyInTeam(teamId, applicantId)) {
        throw new RequestConflictError("You are already in this team.", "JOIN");
    }

    const existing = (await supabaseRest(
        `/join_requests?select=*&team_id=eq.${encodeURIComponent(teamId)}&applicant_user_id=eq.${encodeURIComponent(applicantId)}`
    )) as SupabaseJoinRequestRow[];
    const duplicated = existing.some((row) => {
        const normalized = normalizeStatusName(row.status);
        return !normalized || PENDING_BLOCKING_STATUSES.includes(normalized);
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

export async function getJoinRequestsForTeam(teamId: string): Promise<RequestItem[]> {
    const rows = (await supabaseRest(
        `/join_requests?select=*&team_id=eq.${encodeURIComponent(teamId)}&order=created_at.desc`
    )) as SupabaseJoinRequestRow[];

    return rows
        .map(mapSupabaseJoinRequest)
        .filter((item) => item.status === "PENDING");
}

export async function getJoinApplicationsForManagerByStatuses(
    userId: string,
    statuses: RequestStatus[]
): Promise<RequestItem[]> {
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

export async function getJoinRequestsForApplicantByStatuses(
    userId: string,
    statuses: RequestStatus[]
): Promise<RequestItem[]> {
    const rows = (await supabaseRest(
        `/join_requests?select=*&applicant_user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`
    )) as SupabaseJoinRequestRow[];
    return rows
        .map(mapSupabaseJoinRequest)
        .filter((item) => statuses.includes(item.status));
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

export async function getFileShareRequestsForUserByStatuses(
    userId: string,
    statuses: RequestStatus[]
): Promise<RequestItem[]> {
    const rows = (await supabaseRest(
        `/file_share_requests?select=*&to_user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`
    )) as SupabaseFileRequestRow[];
    return rows
        .map(mapSupabaseFileRequest)
        .filter((item) => statuses.includes(item.status));
}

export async function getFileShareDownloadInfoForUser(
    requestId: string,
    userId: string
): Promise<FileShareDownloadInfo | null> {
    const normalizedRequestId = String(requestId || "").trim();
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedRequestId || !normalizedUserId) return null;

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

    const { addMemberToTeam, hasTeamMembershipRecord } = await import("./teams");
    await Promise.all(
        teamIds.map(async (teamId) => {
            const hasMembershipRecord = await hasTeamMembershipRecord(teamId, userId);
            if (hasMembershipRecord) return;
            await addMemberToTeam(teamId, userId);
        })
    );
}

export async function updateRequestStatus(
    _type: "CHAT" | "FRIEND" | "INVITE" | "JOIN" | "FILE",
    pageId: string,
    status: RequestStatus
): Promise<RequestUpdateContext> {
    const type = _type;

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

    if (type === "FRIEND") {
        const selected = (await supabaseRest(
            `/friend_requests?select=*&request_id=eq.${encodeURIComponent(pageId)}&limit=1`
        )) as SupabaseFriendRequestRow[];
        if (!selected.length) {
            throw new Error("Request not found");
        }
        const current = selected[0];
        const fromId = current.from_user_id;
        const toId = current.to_user_id;

        const [directRows, reverseRows] = await Promise.all([
            supabaseRest(
                `/friend_requests?select=*&from_user_id=eq.${encodeURIComponent(fromId)}&to_user_id=eq.${encodeURIComponent(toId)}`
            ) as Promise<SupabaseFriendRequestRow[]>,
            supabaseRest(
                `/friend_requests?select=*&from_user_id=eq.${encodeURIComponent(toId)}&to_user_id=eq.${encodeURIComponent(fromId)}`
            ) as Promise<SupabaseFriendRequestRow[]>,
        ]);

        const candidateRows = new Map<string, SupabaseFriendRequestRow>();
        for (const row of [...directRows, ...reverseRows]) {
            candidateRows.set(row.request_id, row);
        }
        candidateRows.set(current.request_id, current);

        for (const row of candidateRows.values()) {
            const currentStatus = normalizeStatusName(row.status);
            if (row.request_id !== current.request_id && currentStatus !== "PENDING") continue;
            await supabaseRest(
                `/friend_requests?request_id=eq.${encodeURIComponent(row.request_id)}`,
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
