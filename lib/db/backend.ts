export type DataBackend = "supabase";

export function getDataBackend(): DataBackend {
    return "supabase";
}

export function isSupabaseBackend() {
    return true;
}
