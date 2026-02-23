export async function sendEmail(to: string, subject: string, html: string) {
    if (process.env.EMAIL_ENABLED !== "true") {
        console.log("[Email Disabled] Skipping email to:", to);
        return;
    }

    const resendApiKey = String(process.env.RESEND_API_KEY || "").trim();
    const from = String(process.env.EMAIL_FROM || "").trim();

    if (!resendApiKey || !from) {
        throw new Error(
            "EMAIL_ENABLED=true requires RESEND_API_KEY and EMAIL_FROM.",
        );
    }

    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from,
            to,
            subject,
            html,
        }),
        cache: "no-store",
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Failed to send email (${res.status}): ${text}`);
    }
}
