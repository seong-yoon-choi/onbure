import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseRest } from "@/lib/supabase-rest";

export const runtime = "nodejs";

export async function GET() {
    const backend = "supabase";

    if (!isSupabaseConfigured()) {
        return NextResponse.json(
            {
                ok: false,
                backend,
                error: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.",
            },
            { status: 500 }
        );
    }

    try {
        // Table existence + auth check in one call.
        await supabaseRest("/profiles?select=user_id&limit=1");
        return NextResponse.json({ ok: true, backend, message: "Supabase connection verified." });
    } catch (error: any) {
        return NextResponse.json(
            {
                ok: false,
                backend,
                error: error?.message || "Supabase health check failed.",
            },
            { status: 500 }
        );
    }
}
