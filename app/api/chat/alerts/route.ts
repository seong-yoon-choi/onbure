import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSupabaseBackend } from "@/lib/db/backend";
import { supabaseRest } from "@/lib/supabase-rest";
import { listMessagesForThread, listThreadsForUser } from "@/lib/db/chat-widget";

interface ChatAlertThreadItem {
    threadId: string;
    type: "DM" | "TEAM";
    teamId: string | null;
    participantsUserIds: string[];
    dmSeenMap: Record<string, number>;
    lastMessageAt: string;
    lastSenderId: string;
    lastBodyOriginal: string;
    unreadCount: number;
}

interface ChatAlertsPayload {
    threads: ChatAlertThreadItem[];
}

interface ChatAlertsCacheEntry {
    expiresAt: number;
    payload: ChatAlertsPayload;
}

interface SupabaseAlertMessageRow {
    thread_id: string;
    sender_user_id: string;
    created_at: string;
    body_original: string | null;
}

const CHAT_ALERTS_CACHE_TTL_MS = 8_000;

declare global {
    var __onbureChatAlertsCache: Map<string, ChatAlertsCacheEntry> | undefined;
}

const chatAlertsCache =
    globalThis.__onbureChatAlertsCache ||
    (globalThis.__onbureChatAlertsCache = new Map<string, ChatAlertsCacheEntry>());

function toEpochMs(value: string | number | Date | null | undefined): number {
    if (!value) return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (value instanceof Date) {
        const ms = value.getTime();
        return Number.isFinite(ms) ? ms : 0;
    }
    const ms = Date.parse(String(value));
    return Number.isFinite(ms) ? ms : 0;
}

function buildSupabaseInClause(values: string[]) {
    return values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .map((value) => `"${value.replace(/"/g, '\\"')}"`)
        .join(",");
}

function chunkValues<T>(items: T[], size: number): T[][] {
    const chunkSize = Math.max(1, Math.floor(size));
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
}

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = String((session.user as { id?: string } | undefined)?.id || "").trim();
    if (!currentUserId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = Date.now();
    const cached = chatAlertsCache.get(currentUserId);
    if (cached && cached.expiresAt > now) {
        return NextResponse.json(cached.payload);
    }

    try {
        const threads = await listThreadsForUser(currentUserId);
        const threadIds = Array.from(
            new Set(threads.map((thread) => String(thread.threadId || "").trim()).filter(Boolean))
        );
        const messagesByThreadId = new Map<string, SupabaseAlertMessageRow[]>();

        if (isSupabaseBackend() && threadIds.length > 0) {
            const threadIdChunks = chunkValues(threadIds, 40);
            for (const threadIdChunk of threadIdChunks) {
                const inClause = buildSupabaseInClause(threadIdChunk);
                if (!inClause) continue;
                const rows = (await supabaseRest(
                    `/messages?select=thread_id,sender_user_id,created_at,body_original&thread_id=in.(${encodeURIComponent(
                        inClause
                    )})&order=created_at.asc`
                )) as SupabaseAlertMessageRow[];
                for (const row of rows) {
                    const threadId = String(row.thread_id || "").trim();
                    if (!threadId) continue;
                    const list = messagesByThreadId.get(threadId);
                    if (list) list.push(row);
                    else messagesByThreadId.set(threadId, [row]);
                }
            }
        }

        const threadItems = await Promise.all(
            threads.map(async (thread) => {
                const threadMessages = isSupabaseBackend()
                    ? (messagesByThreadId.get(thread.threadId) || []).map((row) => ({
                          senderId: row.sender_user_id,
                          createdAt: row.created_at,
                          bodyOriginal: row.body_original || "",
                      }))
                    : await listMessagesForThread(thread.threadId, currentUserId, {
                          includeSenderUsernames: false,
                      });

                const lastMessage = threadMessages[threadMessages.length - 1];
                const seenAt = Number(thread.dmSeenMap?.[currentUserId] || 0);

                const unreadCount =
                    thread.type === "dm"
                        ? threadMessages.reduce((count, message) => {
                              const senderId = String(message.senderId || "").trim();
                              if (!senderId || senderId === currentUserId) return count;
                              return toEpochMs(message.createdAt) > seenAt ? count + 1 : count;
                          }, 0)
                        : 0;

                const row: ChatAlertThreadItem = {
                    threadId: thread.threadId,
                    type: thread.type === "team" ? "TEAM" : "DM",
                    teamId: thread.teamId || null,
                    participantsUserIds: thread.participantsUserIds || [],
                    dmSeenMap: thread.dmSeenMap || {},
                    lastMessageAt: lastMessage?.createdAt || thread.lastMessageAt || thread.createdAt || "",
                    lastSenderId: lastMessage?.senderId || "",
                    lastBodyOriginal: lastMessage?.bodyOriginal || "",
                    unreadCount,
                };
                return row;
            })
        );

        const payload: ChatAlertsPayload = {
            threads: threadItems.sort((a, b) => toEpochMs(b.lastMessageAt) - toEpochMs(a.lastMessageAt)),
        };
        chatAlertsCache.set(currentUserId, {
            payload,
            expiresAt: now + CHAT_ALERTS_CACHE_TTL_MS,
        });
        return NextResponse.json(payload);
    } catch (error) {
        console.error("GET /api/chat/alerts failed", error);
        if (cached?.payload) {
            return NextResponse.json(cached.payload);
        }
        return NextResponse.json({ threads: [] as ChatAlertThreadItem[] });
    }
}
