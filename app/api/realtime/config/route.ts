import { NextResponse } from "next/server";
import { getDataBackend } from "@/lib/db/backend";

export const runtime = "nodejs";

function trimSlash(value: string) {
    return value.replace(/\/+$/, "");
}

export async function GET() {
    const backend = getDataBackend();
    const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
    const anonKey = String(
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ""
    ).trim();

    const enabled = backend === "supabase" && Boolean(url) && Boolean(anonKey);
    return NextResponse.json({
        enabled,
        backend,
        url: enabled ? trimSlash(url) : "",
        anonKey: enabled ? anonKey : "",
    });
}

