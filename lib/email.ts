export async function sendEmail(to: string, subject: string, html: string) {
    if (process.env.EMAIL_ENABLED !== "true") {
        console.log("[Email Disabled] Skipping email to:", to);
        return;
    }

    const resendApiKey = String(process.env.RESEND_API_KEY || "").trim();
    const from = String(process.env.EMAIL_FROM || process.env.SMTP_FROM || "").trim();

    if (!resendApiKey || !from) {
        throw new Error(
            "EMAIL_ENABLED=true requires RESEND_API_KEY and EMAIL_FROM (or SMTP_FROM).",
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
        if (res.status === 403 && text.includes("You can only send testing emails to your own email address")) {
            throw new Error(
                `Resend sandbox restriction: current sender (${from}) is not using a verified domain sender for this API key. ` +
                "Set EMAIL_FROM to an address on your verified domain and restart the server."
            );
        }
        throw new Error(`Failed to send email (${res.status}): ${text}`);
    }
}
