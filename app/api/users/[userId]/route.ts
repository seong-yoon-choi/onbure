export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserByUserId } from "@/lib/db/users";
import { getActiveChatPartnerStates, getActiveFriendPartnerStates } from "@/lib/db/requests";

type ConnectionStateMap = Record<string, "PENDING" | "ACCEPTED">;

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
    const [activeChatStates, activeFriendStates] = await Promise.all([
        currentUserId ? getActiveChatPartnerStates(currentUserId) : Promise.resolve({} as ConnectionStateMap),
        currentUserId ? getActiveFriendPartnerStates(currentUserId) : Promise.resolve({} as ConnectionStateMap),
    ]);
    const chatStateValue = activeChatStates[user.userId];
    const friendStateValue = activeFriendStates[user.userId];
    const chatState: "NONE" | "PENDING" | "ACCEPTED" = chatStateValue ?? "NONE";
    const friendState: "NONE" | "PENDING" | "ACCEPTED" = friendStateValue ?? "NONE";
    const isSelf = currentUserId ? user.userId === currentUserId : false;
    const canRequestChat = !isSelf && !chatStateValue;
    const canRequestFriend = !isSelf && !friendStateValue;

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
        friendState,
        canRequestChat,
        canRequestFriend,
        canInvite: !isSelf,
        isSelf,
    });
}
