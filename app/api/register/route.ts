import { NextResponse } from "next/server";
import {
    createUser,
    getUserByEmail,
} from "@/lib/db/users";
import {
    ALLOWED_SIGNUP_COUNTRY_CODES,
    isCookieConsentRequired,
    resolveSignupConsentRegion,
} from "@/lib/signup-consent";

export const runtime = "nodejs";

const ALLOWED_GENDERS = new Set(["male", "female", "other"]);
const ALLOWED_COUNTRIES = new Set(ALLOWED_SIGNUP_COUNTRY_CODES);

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const email = String(body?.email || "").trim().toLowerCase();
        const password = String(body?.password || "");
        const name = String(body?.name || "");
        const gender = String(body?.gender || "").trim().toLowerCase();
        const ageRaw = Number.parseInt(String(body?.age || "").trim(), 10);
        const country = String(body?.country || "").trim().toUpperCase();
        const over14Agreed = Boolean(body?.over14Agreed);
        const privacyAgreed = Boolean(body?.privacyAgreed);
        const cookieAgreed = Boolean(body?.cookieAgreed);
        const language = String(body?.language || "ko").trim();
        let username = String(body?.username || "").trim();

        if (!username && name) {
            username = name.trim();
        }

        if (!email || !username || !password) {
            return NextResponse.json(
                { error: "Email, username, and password are required." },
                { status: 400 }
            );
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
        }
        if (password.length < 8) {
            return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
        }
        if (!ALLOWED_GENDERS.has(gender)) {
            return NextResponse.json({ error: "Please select a valid gender." }, { status: 400 });
        }
        if (!ALLOWED_COUNTRIES.has(country)) {
            return NextResponse.json({ error: "Please select a valid country." }, { status: 400 });
        }
        if (!over14Agreed) {
            return NextResponse.json(
                { error: "You must confirm you are at least 14 years old." },
                { status: 400 }
            );
        }
        if (!privacyAgreed) {
            return NextResponse.json(
                { error: "Privacy Policy consent is required." },
                { status: 400 }
            );
        }
        const consentRegion = resolveSignupConsentRegion(country);
        if (isCookieConsentRequired(consentRegion) && !cookieAgreed) {
            return NextResponse.json(
                { error: "Cookie Policy consent is required for your region." },
                { status: 400 }
            );
        }
        if (!Number.isFinite(ageRaw) || ageRaw <= 0 || ageRaw > 120) {
            return NextResponse.json({ error: "Please enter a valid age." }, { status: 400 });
        }

        const existingUser = await getUserByEmail(email);
        if (existingUser) {
            return NextResponse.json({ error: "User already exists" }, { status: 400 });
        }

        const marketingDataConsent = Boolean(body?.marketingDataConsent);
        const adsReceiveConsent = Boolean(body?.adsReceiveConsent);

        const user = await createUser({
            email,
            username,
            password,
            gender: gender as "male" | "female" | "other",
            age: ageRaw,
            country,
            language,
            marketingDataConsent,
            adsReceiveConsent,
        });


        return NextResponse.json(user);
    } catch (error) {
        console.error(error);
        const message = String((error as any)?.message || "").toLowerCase();
        if (
            message.includes("already registered") ||
            message.includes("already exists") ||
            message.includes("duplicate key value")
        ) {
            return NextResponse.json({ error: "User already exists" }, { status: 400 });
        }
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
