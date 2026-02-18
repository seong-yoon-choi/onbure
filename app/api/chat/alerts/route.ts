import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
        const threadItems = await Promise.all(
            threads.map(async (thread) => {
                const messages = await listMessagesForThread(thread.threadId, currentUserId, {
                    includeSenderUsernames: false,
                });
                const lastMessage = messages[messages.length - 1];
                const seenAt = Number(thread.dmSeenMap?.[currentUserId] || 0);

                const unreadCount =
                    thread.type === "dm"
                        ? messages.reduce((count, message) => {
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
