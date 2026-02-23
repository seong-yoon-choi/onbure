import { supabaseRest } from "@/lib/supabase-rest";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export interface User {
    id: string;
    userId: string;
    email: string;
    username: string; // Changed from name
    publicCode?: string;
    passwordHash?: string;
    emailVerifiedAt?: string | null;
    image?: string;
    gender?: "male" | "female" | "other";
    age?: number;
    country?: string;
    language?: string;
    skills?: string[];
    availabilityHours?: string;
    availabilityStart?: string;
    portfolioLinks?: string[];
    bio?: string;
    marketingDataConsent?: boolean;
    adsReceiveConsent?: boolean;
}

interface SupabaseProfileRow {
    user_id: string;
    email: string;
    username: string;
    public_code?: string | null;
    password_hash?: string | null;
    email_verified_at?: string | null;
    image_url?: string | null;
    gender?: string | null;
    age?: number | null;
    country?: string | null;
    language?: string | null;
    skills?: string[] | null;
    availability_hours_per_week?: string | null;
    availability_start?: string | null;
    portfolio_links?: string[] | null;
    bio?: string | null;
    marketing_data_consent?: boolean | null;
    ads_receive_consent?: boolean | null;
    created_at?: string;
    updated_at?: string;
}

interface SupabaseSignupEmailCodeRow {
    id: string;
    email: string;
    code_hash: string;
    expires_at: string;
    verified_at?: string | null;
    consumed_at?: string | null;
    created_at?: string;
}

function buildSupabaseInClause(values: string[]) {
    return values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .map((value) => `"${value.replace(/"/g, '\\"')}"`)
        .join(",");
}

function fallbackPublicCodeFromUserId(userId: string): string {
    const token = String(userId || "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 10)
        .toUpperCase();
    return `ONB-${token || "USER"}`;
}

function mapSupabaseProfileToUser(row: SupabaseProfileRow): User {
    return {
        id: row.user_id,
        userId: row.user_id,
        email: row.email || "",
        username: row.username || "Unknown",
        publicCode: (row.public_code || "").trim() || fallbackPublicCodeFromUserId(row.user_id),
        passwordHash: row.password_hash || "",
        emailVerifiedAt: row.email_verified_at || null,
        image: row.image_url || undefined,
        gender:
            row.gender === "male" || row.gender === "female" || row.gender === "other"
                ? row.gender
                : undefined,
        age: Number.isFinite(row.age) ? Number(row.age) : undefined,
        country: row.country || undefined,
        language: row.language || undefined,
        skills: Array.isArray(row.skills) ? row.skills : [],
        availabilityHours: row.availability_hours_per_week || undefined,
        availabilityStart: row.availability_start || undefined,
        bio: row.bio || "",
        portfolioLinks: Array.isArray(row.portfolio_links) ? row.portfolio_links : [],
        marketingDataConsent: Boolean(row.marketing_data_consent),
        adsReceiveConsent: Boolean(row.ads_receive_consent),
    };
}

function getSignupEmailCodeTtlMinutes() {
    const raw = Number.parseInt(String(process.env.SIGNUP_EMAIL_CODE_TTL_MINUTES || "10"), 10);
    if (!Number.isFinite(raw) || raw <= 0) return 10;
    return raw;
}

function sha256(value: string) {
    return crypto.createHash("sha256").update(value).digest("hex");
}

function hashSignupCode(email: string, code: string) {
    return sha256(`${String(email || "").trim().toLowerCase()}::${String(code || "").trim()}`);
}

function createSignupCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeAvailability(input: string | number | undefined | null): string | undefined {
    if (input === undefined || input === null || input === "") return undefined;

    const validRanges = ["1-5", "6-10", "11-20", "21-40", "40+"];
    const strInput = String(input).trim();
    if (validRanges.includes(strInput)) return strInput;

    const num = parseFloat(strInput);
    if (isNaN(num)) {
        return undefined;
    }

    if (num <= 5) return "1-5";
    if (num <= 10) return "6-10";
    if (num <= 20) return "11-20";
    if (num <= 40) return "21-40";
    return "40+";
}

async function isPublicCodeTaken(code: string): Promise<boolean> {
    try {
        const rows = (await supabaseRest(
            `/profiles?select=user_id&public_code=eq.${encodeURIComponent(code)}&limit=1`
        )) as Array<{ user_id: string }>;
        return rows.length > 0;
    } catch {
        return false;
    }
}

async function generateUniquePublicCode(): Promise<string> {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let attempt = 0; attempt < 24; attempt += 1) {
        let body = "";
        for (let i = 0; i < 6; i += 1) {
            body += alphabet[Math.floor(Math.random() * alphabet.length)];
        }
        const code = `ONB-${body}`;
        if (!(await isPublicCodeTaken(code))) return code;
    }
    const fallback = uuidv4().replace(/-/g, "").slice(0, 8).toUpperCase();
    return `ONB-${fallback}`;
}

export async function getUserByEmail(email: string): Promise<User | null> {
    const rows = (await supabaseRest(
        `/profiles?select=*&email=eq.${encodeURIComponent(email)}&limit=1`
    )) as SupabaseProfileRow[];
    if (!rows.length) return null;
    return mapSupabaseProfileToUser(rows[0]);
}

export async function getUserByUserId(userId: string): Promise<User | null> {
    const rows = (await supabaseRest(
        `/profiles?select=*&user_id=eq.${encodeURIComponent(userId)}&limit=1`
    )) as SupabaseProfileRow[];
    if (!rows.length) return null;
    return mapSupabaseProfileToUser(rows[0]);
}

export async function verifyUserPassword(userId: string, password: string): Promise<boolean> {
    const normalizedUserId = String(userId || "").trim();
    const rawPassword = String(password || "");
    if (!normalizedUserId || !rawPassword) return false;

    const user = await getUserByUserId(normalizedUserId);
    const passwordHash = String(user?.passwordHash || "");
    if (!passwordHash) return false;

    try {
        return await bcrypt.compare(rawPassword, passwordHash);
    } catch {
        return false;
    }
}

export async function createUser(data: {
    email: string;
    username: string;
    password?: string;
    emailVerifiedAt?: string | null;
    gender?: "male" | "female" | "other";
    age?: number;
    country?: string;
    marketingDataConsent?: boolean;
    adsReceiveConsent?: boolean;
}) {
    const userId = uuidv4();
    const publicCode = await generateUniquePublicCode();
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10);
    const passwordHash = data.password ? await bcrypt.hash(data.password, saltRounds) : "";
    const baseBody = {
        user_id: userId,
        email: data.email,
        username: data.username,
        password_hash: passwordHash,
        email_verified_at: data.emailVerifiedAt ?? null,
        gender: data.gender || null,
        age: Number.isFinite(data.age) ? Number(data.age) : null,
        country: data.country || "KR",
        language: "ko",
        skills: [],
        availability_hours_per_week: "40+",
        bio: "",
        portfolio_links: [],
        marketing_data_consent: Boolean(data.marketingDataConsent),
        ads_receive_consent: Boolean(data.adsReceiveConsent),
    };

    try {
        await supabaseRest("/profiles", {
            method: "POST",
            prefer: "return=representation",
            body: {
                ...baseBody,
                public_code: publicCode,
            },
        });
        return { email: data.email, username: data.username, userId, publicCode };
    } catch (error: any) {
        const message = String(error?.message || "");
        if (!message.includes("public_code")) throw error;

        await supabaseRest("/profiles", {
            method: "POST",
            prefer: "return=representation",
            body: baseBody,
        });
        return {
            email: data.email,
            username: data.username,
            userId,
            publicCode: fallbackPublicCodeFromUserId(userId),
        };
    }
}

export async function issueSignupEmailCode(email: string) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) throw new Error("Email is required.");

    const code = createSignupCode();
    const codeHash = hashSignupCode(normalizedEmail, code);
    const expiresAt = new Date(Date.now() + getSignupEmailCodeTtlMinutes() * 60 * 1000).toISOString();

    await supabaseRest(
        `/signup_email_codes?email=eq.${encodeURIComponent(normalizedEmail)}&consumed_at=is.null`,
        {
            method: "PATCH",
            prefer: "return=minimal",
            body: {
                consumed_at: new Date().toISOString(),
            },
        }
    );

    await supabaseRest("/signup_email_codes", {
        method: "POST",
        prefer: "return=minimal",
        body: {
            email: normalizedEmail,
            code_hash: codeHash,
            expires_at: expiresAt,
        },
    });

    return { code, expiresAt };
}

export type VerifySignupEmailCodeResult =
    | { ok: true }
    | { ok: false; reason: "invalid" | "expired" };

export async function verifySignupEmailCode(email: string, code: string): Promise<VerifySignupEmailCodeResult> {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedCode = String(code || "").trim();
    if (!normalizedEmail || !normalizedCode) return { ok: false, reason: "invalid" };

    const rows = (await supabaseRest(
        `/signup_email_codes?select=id,code_hash,expires_at,verified_at,consumed_at&email=eq.${encodeURIComponent(
            normalizedEmail
        )}&consumed_at=is.null&order=created_at.desc&limit=1`
    )) as SupabaseSignupEmailCodeRow[];

    const row = rows[0];
    if (!row) return { ok: false, reason: "invalid" };

    const expiresAtMs = Date.parse(row.expires_at);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
        return { ok: false, reason: "expired" };
    }

    const codeHash = hashSignupCode(normalizedEmail, normalizedCode);
    if (row.code_hash !== codeHash) {
        return { ok: false, reason: "invalid" };
    }

    if (!row.verified_at) {
        await supabaseRest(`/signup_email_codes?id=eq.${encodeURIComponent(row.id)}&verified_at=is.null`, {
            method: "PATCH",
            prefer: "return=minimal",
            body: {
                verified_at: new Date().toISOString(),
            },
        });
    }

    return { ok: true };
}

export async function consumeVerifiedSignupEmailCode(email: string, code: string): Promise<boolean> {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedCode = String(code || "").trim();
    if (!normalizedEmail || !normalizedCode) return false;

    const rows = (await supabaseRest(
        `/signup_email_codes?select=id,code_hash,expires_at,verified_at,consumed_at&email=eq.${encodeURIComponent(
            normalizedEmail
        )}&consumed_at=is.null&order=created_at.desc&limit=1`
    )) as SupabaseSignupEmailCodeRow[];

    const row = rows[0];
    if (!row || !row.verified_at) return false;

    const expiresAtMs = Date.parse(row.expires_at);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return false;

    const codeHash = hashSignupCode(normalizedEmail, normalizedCode);
    if (row.code_hash !== codeHash) return false;

    const consumed = (await supabaseRest(
        `/signup_email_codes?id=eq.${encodeURIComponent(row.id)}&consumed_at=is.null`,
        {
            method: "PATCH",
            prefer: "return=representation",
            body: {
                consumed_at: new Date().toISOString(),
            },
        }
    )) as SupabaseSignupEmailCodeRow[];

    return consumed.length > 0;
}

export async function deleteUserAccount(userId: string) {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId) {
        throw new Error("User ID is required.");
    }

    const ownedTeams = (await supabaseRest(
        `/teams?select=team_id&primary_owner_user_id=eq.${encodeURIComponent(normalizedUserId)}`
    )) as Array<{ team_id?: string | null }>;

    for (const row of ownedTeams) {
        const teamId = String(row?.team_id || "").trim();
        if (!teamId) continue;
        await supabaseRest(`/teams?team_id=eq.${encodeURIComponent(teamId)}`, {
            method: "DELETE",
            prefer: "return=minimal",
        });
    }

    await supabaseRest(`/profiles?user_id=eq.${encodeURIComponent(normalizedUserId)}`, {
        method: "DELETE",
        prefer: "return=minimal",
    });
}

export async function updateUserProfile(userId: string, data: Partial<User>) {
    const patch: Record<string, any> = {};
    if (data.username !== undefined) patch.username = data.username;
    if (data.email !== undefined) patch.email = data.email;
    if (data.gender !== undefined) patch.gender = data.gender || null;
    if (data.age !== undefined) patch.age = Number.isFinite(data.age) ? Number(data.age) : null;
    if (data.country !== undefined) patch.country = data.country;
    if (data.language !== undefined) patch.language = data.language;
    if (data.skills !== undefined) patch.skills = data.skills;
    if (data.availabilityHours !== undefined) {
        const normalized = normalizeAvailability(data.availabilityHours);
        patch.availability_hours_per_week = normalized || data.availabilityHours || null;
    }
    if (data.availabilityStart !== undefined) patch.availability_start = data.availabilityStart || null;
    if (data.bio !== undefined) patch.bio = data.bio;
    if (data.portfolioLinks !== undefined) patch.portfolio_links = data.portfolioLinks;
    if (data.marketingDataConsent !== undefined) {
        patch.marketing_data_consent = Boolean(data.marketingDataConsent);
    }
    if (data.adsReceiveConsent !== undefined) {
        patch.ads_receive_consent = Boolean(data.adsReceiveConsent);
    }

    if (Object.keys(patch).length === 0) {
        return { ...data, userId };
    }

    const rows = (await supabaseRest(
        `/profiles?user_id=eq.${encodeURIComponent(userId)}`,
        {
            method: "PATCH",
            prefer: "return=representation",
            body: patch,
        }
    )) as SupabaseProfileRow[];

    if (!rows.length) {
        throw new Error("User not found");
    }

    return mapSupabaseProfileToUser(rows[0]);
}

export async function listUsers(): Promise<User[]> {
    const rows = (await supabaseRest("/profiles?select=*")) as SupabaseProfileRow[];
    return rows.map(mapSupabaseProfileToUser);
}

export async function listUsersByUserIds(userIds: string[]): Promise<User[]> {
    const normalizedIds = Array.from(
        new Set(userIds.map((userId) => String(userId || "").trim()).filter(Boolean))
    );
    if (!normalizedIds.length) return [];

    const inClause = buildSupabaseInClause(normalizedIds);
    if (!inClause) return [];

    const rows = (await supabaseRest(
        `/profiles?select=*&user_id=in.(${encodeURIComponent(inClause)})`
    )) as SupabaseProfileRow[];

    const rowByUserId = new Map(rows.map((row) => [row.user_id, row]));

    return normalizedIds
        .map((userId) => rowByUserId.get(userId))
        .filter((row): row is SupabaseProfileRow => Boolean(row))
        .map(mapSupabaseProfileToUser);
}
