import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { appendAuditLog } from "@/lib/db/audit";

export const runtime = "nodejs";

function toSafeText(value: unknown, maxLength: number) {
    return String(value || "").trim().slice(0, maxLength);
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    const actorUserId = String((session?.user as { id?: string } | undefined)?.id || "").trim();

    try {
        const body = await req.json().catch(() => null);
        if (!body || typeof body !== "object") {
            return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
        }

        const payload = body as Record<string, unknown>;
        await appendAuditLog({
            category: "system",
            event: "client_error",
            actorUserId: actorUserId || undefined,
            metadata: {
                message: toSafeText(payload.message, 500),
                stack: toSafeText(payload.stack, 4000),
                path: toSafeText(payload.path, 500),
                source: toSafeText(payload.source, 120),
                context: payload.context && typeof payload.context === "object" ? payload.context : {},
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("POST /api/monitoring/errors failed", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

