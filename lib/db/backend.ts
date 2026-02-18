export type DataBackend = "notion" | "supabase";

export function getDataBackend(): DataBackend {
    const raw = String(process.env.DATA_BACKEND || "notion").trim().toLowerCase();
    return raw === "supabase" ? "supabase" : "notion";
}

export function isSupabaseBackend() {
    return getDataBackend() === "supabase";
}

export function isNotionBackend() {
    return getDataBackend() === "notion";
}
