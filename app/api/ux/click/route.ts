import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseRest } from "@/lib/supabase-rest";

interface ClickBody {
    actionKey?: unknown;
    context?: unknown;
}

function normalizeContext(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 20);
    return Object.fromEntries(entries);
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        const userId = String((session?.user as { id?: string } | undefined)?.id || "").trim();
        if (!session || !userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = (await request.json().catch(() => null)) as ClickBody | null;
        const actionKey = String(body?.actionKey || "").trim();
        if (!actionKey || actionKey.length > 120) {
            return NextResponse.json({ error: "Invalid actionKey" }, { status: 400 });
        }

        const context = normalizeContext(body?.context);

        await supabaseRest("/ux_click_events", {
            method: "POST",
            body: {
                action_key: actionKey,
                user_id: userId,
                context,
            },
            prefer: "return=minimal",
        });

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        // Keep UX logging non-blocking for client calls.
        console.error("POST /api/ux/click failed", error);
        return new NextResponse(null, { status: 204 });
    }
}
