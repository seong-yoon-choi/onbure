import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDmReadReceiptForUser, markDmThreadSeenByUser } from "@/lib/db/chat-widget";

function invalidateChatAlertsCache(userIds: Array<string | undefined | null>) {
    const cache = (globalThis as { __onbureChatAlertsCache?: Map<string, unknown> }).__onbureChatAlertsCache;
    if (!cache) return;
    for (const userId of userIds) {
        const normalized = String(userId || "").trim();
        if (!normalized) continue;
        cache.delete(normalized);
    }
}

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const threadId = req.nextUrl.searchParams.get("threadId");
    if (!threadId) {
        return NextResponse.json({ error: "threadId is required." }, { status: 400 });
    }

    try {
        const currentUserId = String((session.user as { id?: string } | undefined)?.id || "").trim();
        if (!currentUserId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const receipt = await getDmReadReceiptForUser(threadId, currentUserId);
        invalidateChatAlertsCache([currentUserId]);
        return NextResponse.json(receipt);
    } catch (error: any) {
        if (error?.message === "Forbidden") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        console.error("GET /api/chat/read-receipt failed", error);
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { threadId, seenAt } = await req.json();
        if (!threadId || typeof threadId !== "string") {
            return NextResponse.json({ error: "threadId is required." }, { status: 400 });
        }

        const currentUserId = String((session.user as { id?: string } | undefined)?.id || "").trim();
        if (!currentUserId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const seenAtEpoch = Number.isFinite(Number(seenAt)) ? Number(seenAt) : Date.now();
        const receipt = await markDmThreadSeenByUser(threadId, currentUserId, seenAtEpoch);
        invalidateChatAlertsCache([currentUserId]);
        return NextResponse.json(receipt);
    } catch (error: any) {
        if (error?.message === "Forbidden") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        console.error("POST /api/chat/read-receipt failed", error);
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}
