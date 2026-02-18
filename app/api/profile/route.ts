export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserByEmail, getUserByUserId, updateUserProfile } from "@/lib/db/users";
import { getTeamMembershipsForUser } from "@/lib/db/teams";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionUserId = (session.user as any)?.id as string | undefined;
    const user =
        (sessionUserId ? await getUserByUserId(sessionUserId) : null) ||
        (session.user.email ? await getUserByEmail(session.user.email) : null);
    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const resolvedUserId = sessionUserId || user.userId;
    const teamMemberships = resolvedUserId ? await getTeamMembershipsForUser(resolvedUserId) : [];

    return NextResponse.json({
        ...user,
        teamMemberships,
    });
}

export async function PATCH(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    const sessionUserId = (session.user as any).id as string;
    const requestedEmail = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";

    if (requestedEmail) {
        const existing = await getUserByEmail(requestedEmail);
        if (existing && existing.userId !== sessionUserId) {
            return NextResponse.json({ error: "Email is already in use." }, { status: 409 });
        }
        data.email = requestedEmail;
    }

    try {
        const updatedUser = await updateUserProfile(sessionUserId, data);
        return NextResponse.json(updatedUser);
    } catch (error: any) {
        console.error("Profile update error", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
