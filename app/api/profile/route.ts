export const runtime = "nodejs";
const ALLOWED_GENDERS = new Set(["male", "female", "other"]);

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
    deleteUserAccount,
    getUserByEmail,
    getUserByUserId,
    updateUserProfile,
    verifyUserPassword,
} from "@/lib/db/users";
import { getTeamMembershipsForUser } from "@/lib/db/teams";
import { appendAuditLog } from "@/lib/db/audit";

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

    if (data.gender !== undefined && data.gender !== null && data.gender !== "") {
        const normalizedGender = String(data.gender).trim().toLowerCase();
        if (!ALLOWED_GENDERS.has(normalizedGender)) {
            return NextResponse.json({ error: "Please select a valid gender." }, { status: 400 });
        }
        data.gender = normalizedGender;
    } else if (data.gender === "") {
        data.gender = null;
    }

    if (data.age !== undefined && data.age !== null && data.age !== "") {
        const parsedAge = Number.parseInt(String(data.age).trim(), 10);
        if (!Number.isFinite(parsedAge) || parsedAge <= 0 || parsedAge > 120) {
            return NextResponse.json({ error: "Please enter a valid age." }, { status: 400 });
        }
        data.age = parsedAge;
    } else if (data.age === "") {
        data.age = null;
    }

    try {
        const updatedUser = await updateUserProfile(sessionUserId, data);
        return NextResponse.json(updatedUser);
    } catch (error: any) {
        console.error("Profile update error", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionUserId = String((session.user as any)?.id || "").trim();
    if (!sessionUserId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const deleteReason = typeof body?.reason === "string" ? body.reason.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!password) {
        return NextResponse.json({ error: "Password is required." }, { status: 400 });
    }

    try {
        const isValidPassword = await verifyUserPassword(sessionUserId, password);
        if (!isValidPassword) {
            return NextResponse.json({ error: "Invalid password." }, { status: 403 });
        }

        const user =
            (await getUserByUserId(sessionUserId)) ||
            (session.user.email ? await getUserByEmail(session.user.email) : null);

        await appendAuditLog({
            category: "system",
            event: "account_deleted",
            actorUserId: sessionUserId,
            targetUserId: sessionUserId,
            scope: "user",
            metadata: {
                userId: sessionUserId,
                email: user?.email || null,
                reason: deleteReason || null,
            },
        });

        await deleteUserAccount(sessionUserId);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Profile delete error", error);
        return NextResponse.json(
            { error: error?.message || "Failed to delete account." },
            { status: 500 }
        );
    }
}
