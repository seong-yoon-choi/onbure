import { getDataBackend } from "@/lib/db/backend";

function trimSlash(value: string) {
    return value.replace(/\/+$/, "");
}

function assertSupabaseEnv() {
    const url = String(process.env.SUPABASE_URL || "").trim();
    const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!url) throw new Error("Missing SUPABASE_URL");
    if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

    return {
        url: trimSlash(url),
        serviceRoleKey,
    };
}

export function isSupabaseConfigured() {
    return Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function assertSupabaseBackendEnabled() {
    if (getDataBackend() !== "supabase") {
        throw new Error("Supabase backend is not enabled. Set DATA_BACKEND=supabase.");
    }
    if (!isSupabaseConfigured()) {
        throw new Error("Supabase backend is enabled but env vars are missing.");
    }
}

type SupabaseMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface SupabaseRequestOptions {
    method?: SupabaseMethod;
    body?: unknown;
    prefer?: string;
    extraHeaders?: Record<string, string>;
}

export async function supabaseRest(
    path: string,
    { method = "GET", body, prefer, extraHeaders }: SupabaseRequestOptions = {}
) {
    const { url, serviceRoleKey } = assertSupabaseEnv();
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const endpoint = `${url}/rest/v1${normalizedPath}`;

    const res = await fetch(endpoint, {
        method,
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
            ...(prefer ? { Prefer: prefer } : {}),
            ...(extraHeaders || {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase REST Error [${res.status}]: ${text}`);
    }

    if (res.status === 204 || method === "DELETE") return null;

    const raw = await res.text();
    if (!raw || !raw.trim()) return null;

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("application/json")) {
        return JSON.parse(raw);
    }

    try {
        return JSON.parse(raw);
    } catch {
        return raw;
    }
}
