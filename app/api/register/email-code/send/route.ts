import { NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabase-rest";
import { sendEmail } from "@/lib/email";
import {
    createEmailVerificationCookieValue,
    EMAIL_VERIFICATION_COOKIE_NAME,
} from "@/lib/email-verification-cookie";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const { email } = await req.json().catch(() => ({}));
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ error: "Invalid email" }, { status: 400 });
        }
        const normalizedEmail = String(email).trim().toLowerCase();

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const ttlMinutes = parseInt(process.env.SIGNUP_EMAIL_CODE_TTL_MINUTES || "10", 10);
        const expiresAt = new Date(Date.now() + ttlMinutes * 60000).toISOString();

        // Best-effort Supabase upsert. Signup still works with cookie fallback if this fails.
        try {
            await supabaseRest("/verification_codes", {
                method: "POST",
                prefer: "resolution=merge-duplicates,return=minimal",
                body: [
                    {
                        email: normalizedEmail,
                        code,
                        expires_at: expiresAt,
                    },
                ],
            });
        } catch (supabaseError) {
            console.warn("verification_codes upsert failed, using cookie fallback:", supabaseError);
        }

        // Send the email
        await sendEmail(
            normalizedEmail,
            "Verification Code for Onbure",
            `<h1>Verify your email</h1><p>Your verification code is: <strong>${code}</strong></p><p>This code will expire in ${ttlMinutes} minutes.</p>`
        );

        const response = NextResponse.json({ ok: true });
        response.cookies.set({
            name: EMAIL_VERIFICATION_COOKIE_NAME,
            value: createEmailVerificationCookieValue(normalizedEmail, code, expiresAt),
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            expires: new Date(expiresAt),
        });

        return response;
    } catch (error: any) {
        console.error("Failed to send email code:", error);
        const message = String(error?.message || "");
        return NextResponse.json(
            { error: message || "Failed to send verification code" },
            { status: 500 }
        );
    }
}
