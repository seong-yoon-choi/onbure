import { NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabase-rest";
import { sendEmail } from "@/lib/email";
import {
    createEmailVerificationCookieValue,
    EMAIL_VERIFICATION_COOKIE_NAME,
} from "@/lib/email-verification-cookie";

export const runtime = "nodejs";

function buildVerificationCodeEmailHtml(code: string, ttlMinutes: number) {
    const currentYear = new Date().getFullYear();

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your Verification Code</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; color: #111827; margin: 0; padding: 40px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 448px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
    <tr>
      <td style="padding: 40px 30px;">
        <h2 style="margin-top: 0; font-size: 24px; font-weight: 600; color: #111827;">Welcome to Onbure! 🚀</h2>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.5; margin-bottom: 24px;">
          Thanks for signing up. To complete your registration and verify your email address, please use the following 6-digit code:
        </p>

        <div style="background-color: #f3f4f6; border-radius: 6px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <h1 style="margin: 0; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #10b981;">
            ${code}
          </h1>
        </div>

        <p style="font-size: 14px; color: #6b7280; line-height: 1.5; margin-bottom: 8px;">
          This code is valid for the next ${ttlMinutes} minutes. If you didn't request this email, you can safely ignore it.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

        <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
          Need help? Reply to this email or contact our support team.<br>
          &copy; ${currentYear} Onbure. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

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
            "Your Verification Code",
            buildVerificationCodeEmailHtml(code, ttlMinutes),
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
