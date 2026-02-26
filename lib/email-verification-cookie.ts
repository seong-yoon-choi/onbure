import crypto from "crypto";

export const EMAIL_VERIFICATION_COOKIE_NAME = "onbure_email_verification";

interface EmailVerificationPayload {
    email: string;
    codeHash: string;
    expiresAt: string;
}

type EmailVerificationResult = "ok" | "invalid" | "expired";

function getVerificationSecret() {
    return String(
        process.env.EMAIL_VERIFICATION_SECRET ||
        process.env.NEXTAUTH_SECRET ||
        process.env.AUTH_SECRET ||
        "onbure-email-verification-dev-secret"
    ).trim();
}

function normalizeEmail(email: string) {
    return email.trim().toLowerCase();
}

function normalizeCode(code: string) {
    return code.trim();
}

function hashCode(email: string, code: string, secret: string) {
    return crypto
        .createHash("sha256")
        .update(`${normalizeEmail(email)}:${normalizeCode(code)}:${secret}`)
        .digest("hex");
}

function signPayload(encodedPayload: string, secret: string) {
    return crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function encodePayload(payload: EmailVerificationPayload) {
    return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(encoded: string) {
    const raw = Buffer.from(encoded, "base64url").toString("utf8");
    return JSON.parse(raw) as EmailVerificationPayload;
}

export function createEmailVerificationCookieValue(email: string, code: string, expiresAt: string) {
    const secret = getVerificationSecret();
    const payload: EmailVerificationPayload = {
        email: normalizeEmail(email),
        codeHash: hashCode(email, code, secret),
        expiresAt,
    };
    const encodedPayload = encodePayload(payload);
    const signature = signPayload(encodedPayload, secret);
    return `${encodedPayload}.${signature}`;
}

export function validateEmailVerificationCookie(
    token: string,
    email: string,
    code: string
): EmailVerificationResult {
    const secret = getVerificationSecret();
    const [encodedPayload, signature = ""] = String(token || "").split(".");
    if (!encodedPayload || !signature) return "invalid";

    const expectedSignature = signPayload(encodedPayload, secret);
    const receivedSignature = Buffer.from(signature, "base64url");
    const expectedSignatureBuffer = Buffer.from(expectedSignature, "base64url");
    if (receivedSignature.length !== expectedSignatureBuffer.length) return "invalid";
    if (!crypto.timingSafeEqual(receivedSignature, expectedSignatureBuffer)) return "invalid";

    let payload: EmailVerificationPayload;
    try {
        payload = decodePayload(encodedPayload);
    } catch {
        return "invalid";
    }

    if (!payload?.email || !payload?.codeHash || !payload?.expiresAt) return "invalid";
    if (normalizeEmail(payload.email) !== normalizeEmail(email)) return "invalid";
    if (new Date(payload.expiresAt) < new Date()) return "expired";

    const expectedHash = hashCode(email, code, secret);
    if (payload.codeHash !== expectedHash) return "invalid";

    return "ok";
}

export function readCookieValue(cookieHeader: string | null, cookieName: string) {
    if (!cookieHeader) return null;
    const pairs = cookieHeader.split(";");
    for (const pair of pairs) {
        const trimmed = pair.trim();
        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex < 0) continue;

        const key = trimmed.slice(0, separatorIndex);
        if (key !== cookieName) continue;

        const value = trimmed.slice(separatorIndex + 1);
        return decodeURIComponent(value);
    }
    return null;
}

