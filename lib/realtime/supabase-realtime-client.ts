"use client";

type RealtimeEventType = "*" | "INSERT" | "UPDATE" | "DELETE";

export interface RealtimeSubscriptionSpec {
    table: string;
    event?: RealtimeEventType;
    schema?: string;
    filter?: string;
}

export interface RealtimeChangePayload {
    schema: string;
    table: string;
    eventType: string;
    commitTimestamp?: string;
    newRecord?: Record<string, unknown>;
    oldRecord?: Record<string, unknown>;
}

interface RealtimeConfigResponse {
    enabled?: boolean;
    backend?: string;
    url?: string;
    anonKey?: string;
}

interface RealtimeConfig {
    wsUrl: string;
    anonKey: string;
}

interface PhoenixEnvelope {
    topic?: string;
    event?: string;
    payload?: Record<string, unknown>;
    ref?: string | null;
}

let cachedConfigPromise: Promise<RealtimeConfig | null> | null = null;

function toWsUrl(baseUrl: string, anonKey: string) {
    const wsBase = baseUrl.replace(/^http/i, "ws");
    return `${wsBase}/realtime/v1/websocket?apikey=${encodeURIComponent(anonKey)}&vsn=1.0.0`;
}

async function getRealtimeConfig(): Promise<RealtimeConfig | null> {
    if (cachedConfigPromise) return cachedConfigPromise;

    cachedConfigPromise = (async () => {
        try {
            const res = await fetch("/api/realtime/config", { cache: "no-store" });
            if (!res.ok) return null;

            const payload = (await res.json()) as RealtimeConfigResponse;
            if (!payload?.enabled || payload.backend !== "supabase") return null;

            const url = String(payload.url || "").trim();
            const anonKey = String(payload.anonKey || "").trim();
            if (!url || !anonKey) return null;

            return {
                wsUrl: toWsUrl(url, anonKey),
                anonKey,
            };
        } catch {
            return null;
        }
    })();

    const resolved = await cachedConfigPromise;
    if (!resolved) {
        cachedConfigPromise = null;
    }
    return resolved;
}

function parseRealtimePayload(payload: Record<string, unknown> | undefined): RealtimeChangePayload | null {
    if (!payload || typeof payload !== "object") return null;
    const data = (payload.data && typeof payload.data === "object"
        ? (payload.data as Record<string, unknown>)
        : payload) as Record<string, unknown>;

    const schema = String(data.schema || "");
    const table = String(data.table || "");
    const eventType = String(data.eventType || data.type || "");
    if (!schema || !table || !eventType) return null;

    return {
        schema,
        table,
        eventType,
        commitTimestamp: typeof data.commit_timestamp === "string" ? data.commit_timestamp : undefined,
        newRecord: (data.new && typeof data.new === "object") ? (data.new as Record<string, unknown>) : undefined,
        oldRecord: (data.old && typeof data.old === "object") ? (data.old as Record<string, unknown>) : undefined,
    };
}

export function subscribeToSupabaseRealtime(
    specs: RealtimeSubscriptionSpec[],
    onChange: (payload: RealtimeChangePayload) => void
) {
    let closedByClient = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let attempt = 0;
    let refSeq = 0;

    const normalizedSpecs = specs
        .map((spec) => ({
            event: spec.event || "*",
            schema: spec.schema || "public",
            table: String(spec.table || "").trim(),
            filter: String(spec.filter || "").trim(),
        }))
        .filter((spec) => Boolean(spec.table));

    if (!normalizedSpecs.length) {
        return () => undefined;
    }

    const nextRef = () => {
        refSeq += 1;
        return String(refSeq);
    };

    const clearTimers = () => {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
    };

    const sendEnvelope = (envelope: PhoenixEnvelope) => {
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify(envelope));
    };

    const scheduleReconnect = () => {
        if (closedByClient) return;
        clearTimers();
        const delayMs = Math.min(15000, 1000 * Math.max(1, 2 ** attempt));
        reconnectTimer = setTimeout(() => {
            attempt += 1;
            void connect();
        }, delayMs);
    };

    const handleOpen = (config: RealtimeConfig, topic: string) => {
        attempt = 0;
        const postgresChanges = normalizedSpecs.map((spec) => ({
            event: spec.event,
            schema: spec.schema,
            table: spec.table,
            ...(spec.filter ? { filter: spec.filter } : {}),
        }));

        sendEnvelope({
            topic,
            event: "phx_join",
            payload: {
                config: {
                    broadcast: { ack: false, self: false },
                    presence: { key: "" },
                    postgres_changes: postgresChanges,
                },
                access_token: config.anonKey,
            },
            ref: nextRef(),
        });

        heartbeatTimer = setInterval(() => {
            sendEnvelope({
                topic: "phoenix",
                event: "heartbeat",
                payload: {},
                ref: nextRef(),
            });
        }, 25000);
    };

    const connect = async () => {
        const config = await getRealtimeConfig();
        if (!config || closedByClient) return;

        const topic = `realtime:onbure_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
        socket = new WebSocket(config.wsUrl);

        socket.addEventListener("open", () => handleOpen(config, topic));
        socket.addEventListener("message", (event) => {
            try {
                const envelope = JSON.parse(String(event.data || "{}")) as PhoenixEnvelope;
                if (envelope.event !== "postgres_changes") return;
                const parsed = parseRealtimePayload(envelope.payload);
                if (!parsed) return;
                onChange(parsed);
            } catch {
                // ignore malformed events
            }
        });
        socket.addEventListener("close", () => {
            socket = null;
            scheduleReconnect();
        });
        socket.addEventListener("error", () => {
            socket?.close();
        });
    };

    void connect();

    return () => {
        closedByClient = true;
        clearTimers();
        if (socket && socket.readyState === WebSocket.OPEN) {
            sendEnvelope({
                topic: "phoenix",
                event: "phx_leave",
                payload: {},
                ref: nextRef(),
            });
        }
        socket?.close();
        socket = null;
    };
}

export interface AuditLogRealtimeRow {
    id: string;
    category: string;
    event: string;
    scope?: string;
    actor_user_id?: string | null;
    target_user_id?: string | null;
    team_id?: string | null;
    metadata?: Record<string, unknown> | null;
    created_at?: string;
}

export function subscribeToAuditLogRealtime(
    onRow: (row: AuditLogRealtimeRow) => void
) {
    return subscribeToSupabaseRealtime(
        [{ table: "audit_logs", event: "INSERT", schema: "public" }],
        (payload) => {
            if (payload.table !== "audit_logs") return;
            if (!payload.newRecord) return;
            onRow(payload.newRecord as unknown as AuditLogRealtimeRow);
        }
    );
}
