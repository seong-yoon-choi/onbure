import { MessageItem } from "./types";

export function clamp(v: number, a: number, b: number) {
    return Math.max(a, Math.min(b, v));
}

export function clampRange(v: number, minValue: number, maxValue: number) {
    const lo = Math.min(minValue, maxValue);
    const hi = Math.max(minValue, maxValue);
    return clamp(v, lo, hi);
}

export function toEpochMs(value: string | number | Date | null | undefined): number {
    if (!value) return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (value instanceof Date) {
        const ms = value.getTime();
        return Number.isFinite(ms) ? ms : 0;
    }
    const ms = Date.parse(String(value));
    return Number.isFinite(ms) ? ms : 0;
}

export function uniqueMessageKey(message: MessageItem) {
    return message.id || message.messageId || `${message.threadId}:${message.senderId}:${message.createdAt}:${message.bodyOriginal}`;
}

export function dedupeMessages(messages: MessageItem[]) {
    const seen = new Set<string>();
    const unique: MessageItem[] = [];
    for (const message of messages) {
        const key = uniqueMessageKey(message);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        unique.push(message);
    }
    return unique;
}

export function previewText(value?: string) {
    const text = (value || "").trim();
    return text || "No messages yet.";
}

export function toDmThreadId(currentUserId: string, otherUserId: string) {
    return `dm::${[currentUserId, otherUserId].sort().join("::")}`;
}

export function readSeenMap(storageKey: string): Record<string, number> {
    if (typeof window === "undefined" || !storageKey) return {};
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (!parsed || typeof parsed !== "object") return {};

        const normalized: Record<string, number> = {};
        for (const [threadId, value] of Object.entries(parsed)) {
            const epoch = toEpochMs(value as string | number | Date | null | undefined);
            if (threadId && epoch > 0) {
                normalized[threadId] = epoch;
            }
        }
        return normalized;
    } catch {
        return {};
    }
}

export function writeSeenMap(storageKey: string, map: Record<string, number>) {
    if (typeof window === "undefined" || !storageKey) return;
    try {
        localStorage.setItem(storageKey, JSON.stringify(map));
    } catch {
        // noop
    }
}

export function formatUnreadCount(count: number) {
    return count > 99 ? "99+" : String(count);
}
