import { NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabase-rest";
import {
    EMAIL_VERIFICATION_COOKIE_NAME,
    readCookieValue,
    validateEmailVerificationCookie,
} from "@/lib/email-verification-cookie";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const { email, code } = await req.json().catch(() => ({}));
        if (!email || !code) {
            return NextResponse.json({ error: "Email and code are required" }, { status: 400 });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const normalizedCode = code.trim();

        const cookieHeader = req.headers.get("cookie");
        const verificationCookie = readCookieValue(cookieHeader, EMAIL_VERIFICATION_COOKIE_NAME);

        if (verificationCookie) {
            const cookieValidationResult = validateEmailVerificationCookie(
                verificationCookie,
                normalizedEmail,
                normalizedCode
            );

            if (cookieValidationResult === "expired") {
                return NextResponse.json({ error: "Code expired. Please request a new one." }, { status: 400 });
            }
            if (cookieValidationResult === "invalid") {
                return NextResponse.json({ error: "Invalid verification code." }, { status: 400 });
            }

            const successResponse = NextResponse.json({ ok: true });
            successResponse.cookies.set({
                name: EMAIL_VERIFICATION_COOKIE_NAME,
                value: "",
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
                maxAge: 0,
            });
            return successResponse;
        }

        // Fallback for sessions where cookie is unavailable.
        const rows = await supabaseRest(
            `/verification_codes?select=*&email=eq.${encodeURIComponent(normalizedEmail)}&limit=1`
        ) as Array<{ code: string; expires_at: string }>;

        if (!rows.length) {
            return NextResponse.json({ error: "Code not found. Please request a new one." }, { status: 400 });
        }

        const entry = rows[0];
        if (new Date(entry.expires_at) < new Date()) {
            return NextResponse.json({ error: "Code expired. Please request a new one." }, { status: 400 });
        }

        if (entry.code !== normalizedCode) {
            return NextResponse.json({ error: "Invalid verification code." }, { status: 400 });
        }

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error("Failed to verify email code:", error);
        const message = String(error?.message || "");
        if (message.includes("PGRST205") || message.includes("verification_codes")) {
            return NextResponse.json(
                {
                    error: "Signup verification storage is not initialized. Run supabase/schema.sql to create verification_codes table.",
                },
                { status: 500 }
            );
        }
        return NextResponse.json(
            { error: message || "Failed to verify code" },
            { status: 500 }
        );
    }
}
