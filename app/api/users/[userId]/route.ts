export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserByUserId } from "@/lib/db/users";
import { getActiveChatPartnerStates } from "@/lib/db/requests";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params;
    if (!userId) {
        return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const currentUserId = (session.user as any)?.id as string | undefined;
    const user = await getUserByUserId(userId);
    if (!user) {
        return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    const activeStates = currentUserId ? await getActiveChatPartnerStates(currentUserId) : {};
    const stateValue = activeStates[user.userId];
    const chatState: "NONE" | "PENDING" | "ACCEPTED" = stateValue ?? "NONE";
    const isSelf = currentUserId ? user.userId === currentUserId : false;
    const canRequestChat = !isSelf && !stateValue;

    return NextResponse.json({
        userId: user.userId,
        publicCode: user.publicCode || "",
        email: user.email || "",
        username: user.username,
        country: user.country || "",
        language: user.language || "",
        skills: user.skills || [],
        availabilityHours: user.availabilityHours || "",
        availabilityStart: user.availabilityStart || "",
        bio: user.bio || "",
        portfolioLinks: user.portfolioLinks || [],
        chatState,
        canRequestChat,
        canInvite: !isSelf,
        isSelf,
    });
}
