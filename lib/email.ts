export async function sendEmail(to: string, subject: string, _html: string) {
    void _html;
    if (process.env.EMAIL_ENABLED !== "true") {
        console.log("[Email Disabled] Skipping email to:", to);
        return;
    }

    // Implementation for SMTP would go here (Nodemailer, etc.)
    console.log(`[Email Sent] To: ${to}, Subject: ${subject}`);
}
