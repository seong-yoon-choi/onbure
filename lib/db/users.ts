import { notion, getDatabaseId, getTextValue, getSelectValue } from "@/lib/notion-client";
import { getDatabaseSchema, assertDatabaseHasProperties } from "@/lib/notion-schema";
import { buildProps } from "@/lib/notion-props";
import { isSupabaseBackend } from "@/lib/db/backend";
import { supabaseRest } from "@/lib/supabase-rest";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";

export interface User {
    id: string;
    userId: string;
    email: string;
    username: string; // Changed from name
    publicCode?: string;
    passwordHash?: string;
    image?: string;
    country?: string;
    language?: string;
    skills?: string[];
    availabilityHours?: string;
    availabilityStart?: string;
    portfolioLinks?: string[];
    bio?: string;
}

const DB_KEY = "NOTION_DB_USERS";

interface SupabaseProfileRow {
    user_id: string;
    email: string;
    username: string;
    public_code?: string | null;
    password_hash?: string | null;
    image_url?: string | null;
    country?: string | null;
    language?: string | null;
    skills?: string[] | null;
    availability_hours_per_week?: string | null;
    availability_start?: string | null;
    portfolio_links?: string[] | null;
    bio?: string | null;
    created_at?: string;
    updated_at?: string;
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
        image: row.image_url || undefined,
        country: row.country || undefined,
        language: row.language || undefined,
        skills: Array.isArray(row.skills) ? row.skills : [],
        availabilityHours: row.availability_hours_per_week || undefined,
        availabilityStart: row.availability_start || undefined,
        bio: row.bio || "",
        portfolioLinks: Array.isArray(row.portfolio_links) ? row.portfolio_links : [],
    };
}

/**
 * Normalizes availability input to standardized Select options.
 * Handles legacy number inputs and maps them to ranges.
 */
function normalizeAvailability(input: string | number | undefined | null): string | undefined {
    if (input === undefined || input === null || input === "") return undefined;

    // If it's already one of our valid ranges, return it
    const validRanges = ["1-5", "6-10", "11-20", "21-40", "40+"];
    const strInput = String(input).trim();
    if (validRanges.includes(strInput)) return strInput;

    // Try to parse as number
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
        // If column is not migrated yet, skip collision check and rely on fallback insert path.
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

function getMissingProfilesColumnFromError(error: unknown): string | null {
    const message = String((error as any)?.message || "");
    const match = message.match(/Could not find the '([^']+)' column of 'profiles' in the schema cache/i);
    return match?.[1] ? String(match[1]) : null;
}

function omitKey<T extends Record<string, any>>(target: T, key: string): T {
    const next = { ...target };
    delete next[key];
    return next;
}

async function patchProfileWithSchemaFallback(
    userId: string,
    patch: Record<string, any>
): Promise<SupabaseProfileRow[]> {
    let currentPatch = { ...patch };
    for (let attempt = 0; attempt < 12; attempt += 1) {
        if (Object.keys(currentPatch).length === 0) return [];

        try {
            return (await supabaseRest(
                `/profiles?user_id=eq.${encodeURIComponent(userId)}`,
                {
                    method: "PATCH",
                    prefer: "return=representation",
                    body: currentPatch,
                }
            )) as SupabaseProfileRow[];
        } catch (error) {
            const missingColumn = getMissingProfilesColumnFromError(error);
            if (missingColumn && Object.prototype.hasOwnProperty.call(currentPatch, missingColumn)) {
                currentPatch = omitKey(currentPatch, missingColumn);
                continue;
            }
            throw error;
        }
    }

    return [];
}

async function insertProfileWithSchemaFallback(
    body: Record<string, any>
): Promise<SupabaseProfileRow[]> {
    let currentBody = { ...body };
    for (let attempt = 0; attempt < 12; attempt += 1) {
        try {
            return (await supabaseRest("/profiles", {
                method: "POST",
                prefer: "return=representation",
                body: currentBody,
            })) as SupabaseProfileRow[];
        } catch (error) {
            const missingColumn = getMissingProfilesColumnFromError(error);
            if (missingColumn && Object.prototype.hasOwnProperty.call(currentBody, missingColumn)) {
                currentBody = omitKey(currentBody, missingColumn);
                continue;
            }
            throw error;
        }
    }

    throw new Error("Failed to insert profile due to repeated schema mismatch.");
}

async function createSupabaseAdminClient() {
    const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
    const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Supabase Admin configuration is missing.");
    }

    const { createClient } = await import("@supabase/supabase-js");
    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}

export async function getUserByEmail(email: string): Promise<User | null> {
    if (isSupabaseBackend()) {
        const rows = (await supabaseRest(
            `/profiles?select=*&email=eq.${encodeURIComponent(email)}&limit=1`
        )) as SupabaseProfileRow[];
        if (!rows.length) return null;
        return mapSupabaseProfileToUser(rows[0]);
    }

    const dbId = getDatabaseId(DB_KEY);

    const response = await notion.databases.query({
        database_id: dbId,
        filter: {
            property: "email",
            email: {
                equals: email,
            },
        },
    });

    if (response.results.length === 0) return null;

    const page = response.results[0] as any;
    const props = page.properties;

    // Robust reading: Handle if it's still a number property or a select property
    let availability = getSelectValue(props.availability_hours_per_week);
    if (!availability && props.availability_hours_per_week?.number) {
        // Fallback for legacy number data
        availability = normalizeAvailability(props.availability_hours_per_week.number);
    }
    // Also normalize just in case the select value is somehow weird
    if (availability) {
        const normalized = normalizeAvailability(availability);
        if (normalized) availability = normalized;
    }

    // Try to get username from 'username' property, fallback to 'name' if old schema persists temporarily, 
    // or 'title' if it's the title column.
    // The prompt says "Notion users DB name property rename -> username".
    // We expect 'username' property to exist (and likely be the Title).
    // Let's use getTextValue on 'username' property.
    const username = getTextValue(props.username);

    // Fallback: if username property is empty (maybe renamed but not populated?), try display_name just in case?
    // No, instructions say display_name is deleted. 
    // If username is the title, getTextValue works if passed the title prop object.
    // But we don't know the exact object key if it was renamed in Notion UI but API might still see old ID? 
    // No, API sees current name.

    // Special handling for Title if 'username' is the title.
    // simpler: valid schema has 'username'.

    return {
        id: page.id,
        userId: getTextValue(props.user_id),
        email: props.email?.email || "",
        username: username || "Unknown",
        publicCode: fallbackPublicCodeFromUserId(getTextValue(props.user_id)),
        passwordHash: getTextValue(props.password_hash),
        country: getSelectValue(props.country),
        language: getSelectValue(props.language),
        skills: props.skills?.multi_select?.map((o: any) => o.name) || [],
        availabilityHours: availability,
        availabilityStart: props.availability_start?.date?.start,
        bio: getTextValue(props.bio),
        portfolioLinks: getTextValue(props.portfolio_links)?.split("\n").filter(Boolean) || [],
    };
}

export async function getUserByUserId(userId: string): Promise<User | null> {
    if (isSupabaseBackend()) {
        const rows = (await supabaseRest(
            `/profiles?select=*&user_id=eq.${encodeURIComponent(userId)}&limit=1`
        )) as SupabaseProfileRow[];
        if (!rows.length) return null;
        return mapSupabaseProfileToUser(rows[0]);
    }

    const dbId = getDatabaseId(DB_KEY);

    const response = await notion.databases.query({
        database_id: dbId,
        filter: {
            property: "user_id",
            rich_text: {
                equals: userId,
            },
        },
    });

    if (response.results.length === 0) return null;

    const page = response.results[0] as any;
    const props = page.properties;

    let availability = getSelectValue(props.availability_hours_per_week);
    if (!availability && props.availability_hours_per_week?.number) {
        availability = normalizeAvailability(props.availability_hours_per_week.number);
    }
    if (availability) {
        const normalized = normalizeAvailability(availability);
        if (normalized) availability = normalized;
    }

    const username = getTextValue(props.username);

    return {
        id: page.id,
        userId: getTextValue(props.user_id),
        email: props.email?.email || "",
        username: username || "Unknown",
        publicCode: fallbackPublicCodeFromUserId(getTextValue(props.user_id)),
        passwordHash: getTextValue(props.password_hash),
        country: getSelectValue(props.country),
        language: getSelectValue(props.language),
        skills: props.skills?.multi_select?.map((o: any) => o.name) || [],
        availabilityHours: availability,
        availabilityStart: props.availability_start?.date?.start,
        bio: getTextValue(props.bio),
        portfolioLinks: getTextValue(props.portfolio_links)?.split("\n").filter(Boolean) || [],
    };
}

export async function verifyUserPassword(userId: string, password: string): Promise<boolean> {
    if (!userId || !password) return false;

    const user = await getUserByUserId(userId);
    if (!user) return false;

    // Supabase-backed users in this project may be stored either as bcrypt hashes
    // in profiles.password_hash or as Supabase Auth accounts depending on recovery state.
    if (user.passwordHash) {
        try {
            return await bcrypt.compare(password, user.passwordHash);
        } catch {
            return false;
        }
    }

    if (!isSupabaseBackend() || !user.email) return false;

    try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
        const anonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "").trim();
        if (!supabaseUrl || !anonKey) return false;

        const supabase = createClient(supabaseUrl, anonKey, {
            auth: { persistSession: false },
        });
        const { data, error } = await supabase.auth.signInWithPassword({
            email: user.email,
            password,
        });
        return !error && Boolean(data.session);
    } catch {
        return false;
    }
}

export async function createUser(data: {
    email: string;
    username: string;
    password?: string;
    gender?: "male" | "female" | "other";
    age?: number;
    country?: string;
    marketingDataConsent?: boolean;
    adsReceiveConsent?: boolean;
}) {
    if (isSupabaseBackend()) {
        if (!data.password) {
            throw new Error("Password is required.");
        }

        const adminClient = await createSupabaseAdminClient();
        const publicCode = await generateUniquePublicCode();
        const normalizedCountry = String(data.country || "KR").trim().toUpperCase() || "KR";
        const normalizedAge = Number.isFinite(Number(data.age)) ? Number(data.age) : null;

        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
            email: data.email,
            password: data.password,
            email_confirm: true,
            user_metadata: {
                username: data.username,
                gender: data.gender || null,
                age: normalizedAge,
                country: normalizedCountry,
            },
        });

        if (authError) {
            throw new Error(`Supabase Auth Error: ${authError.message}`);
        }

        const userId = String(authData?.user?.id || "").trim();
        if (!userId) {
            throw new Error("Supabase Auth Error: user ID was not returned.");
        }

        const profilePatch = {
            username: data.username,
            gender: data.gender || null,
            age: normalizedAge,
            country: normalizedCountry,
            language: "ko",
            skills: [],
            availability_hours_per_week: "40+",
            bio: "",
            portfolio_links: [],
            public_code: publicCode,
            marketing_data_consent: Boolean(data.marketingDataConsent),
            ads_receive_consent: Boolean(data.adsReceiveConsent),
        };

        try {
            const patched = await patchProfileWithSchemaFallback(userId, profilePatch);
            if (!patched.length) {
                await insertProfileWithSchemaFallback({
                    user_id: userId,
                    email: data.email,
                    ...profilePatch,
                });
            }
        } catch (error) {
            try {
                await adminClient.auth.admin.deleteUser(userId);
            } catch {
                // Best effort rollback only.
            }
            throw error;
        }

        const created = await getUserByUserId(userId);
        return {
            email: data.email,
            username: data.username,
            userId,
            publicCode: created?.publicCode || fallbackPublicCodeFromUserId(userId),
        };
    }

    const dbId = getDatabaseId(DB_KEY);
    const schema = await getDatabaseSchema(dbId);

    // 1. Assert Schema correct for writing
    assertDatabaseHasProperties(schema, {
        email: "email",
        password_hash: "rich_text",
        username: "title", // We assume 'username' is the Title property now
        country: "select",
        language: "select",
        user_id: "rich_text",
        skills: "multi_select",
        availability_hours_per_week: "select",
        availability_start: "date",
        portfolio_links: "rich_text",
        bio: "rich_text",
    });

    const userId = uuidv4();
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10);
    const passwordHash = data.password ? await bcrypt.hash(data.password, saltRounds) : "";

    const availability = normalizeAvailability("40+"); // Default

    const logicalData: Record<string, any> = {
        title: data.username, // Map username to title

        username: data.username, // Also explicitly set username property if it's not the title (but we assume it is)
        // actually if 'username' IS the title, 'title' key in logicalData covers it via buildProps
        // but buildProps handles 'title' special key. 
        // If the actual column name is "username", buildProps will only fill it 
        // if we pass 'title' key! 
        // Wait, `getTitlePropertyName` finds the key. `buildProps` uses `title` logical key.
        // So we just need `title: data.username`.

        email: data.email,
        password_hash: passwordHash,
        user_id: userId,
        country: "KR", // Default
        language: typeof navigator !== "undefined" ? navigator.language : "ko", // Browser lang or default
        created_at: new Date(),
        skills: [],
        availability_hours_per_week: availability,
        bio: "",
        portfolio_links: ""
    };

    // 3. Build Dynamic Payload
    const properties = buildProps(schema, logicalData);

    await notion.pages.create({
        parent: { database_id: dbId },
        properties: properties,
    });

    return {
        email: data.email,
        username: data.username,
        userId,
        publicCode: fallbackPublicCodeFromUserId(userId),
    };
}

export async function updateUserProfile(userId: string, data: Partial<User>) {
    if (isSupabaseBackend()) {
        const patch: Record<string, any> = {};
        if (data.username !== undefined) patch.username = data.username;
        if (data.email !== undefined) patch.email = data.email;
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

    const dbId = getDatabaseId(DB_KEY);
    const schema = await getDatabaseSchema(dbId);

    let pageId: string;
    if (data.id) {
        pageId = data.id;
    } else {
        const response = await notion.databases.query({
            database_id: dbId,
            filter: {
                property: "user_id",
                rich_text: { equals: userId }
            }
        });
        if (response.results.length === 0) throw new Error("User not found");
        pageId = response.results[0].id;
    }

    const logicalData: Record<string, any> = {};
    if (data.username) {
        logicalData.title = data.username;
        // logicalData.username = data.username; // If it's title, no need to duplicate? 
        // If 'username' is NOT title (e.g. Title is meaningless ID), we should set 'username'.
        // But prompt says "name 속성 rename -> username". Usually 'name' was Title.
        // So 'username' is the Title.
    }
    if (data.email) logicalData.email = data.email;
    if (data.country) logicalData.country = data.country;
    if (data.language) logicalData.language = data.language;
    if (data.skills) logicalData.skills = data.skills;

    if (data.availabilityHours) {
        const normalized = normalizeAvailability(data.availabilityHours);
        if (normalized) {
            logicalData.availability_hours_per_week = normalized;
        }
    }

    if (data.availabilityStart) logicalData.availability_start = new Date(data.availabilityStart);
    if (data.bio) logicalData.bio = data.bio;
    if (data.portfolioLinks) logicalData.portfolio_links = data.portfolioLinks.join("\n");

    const props = buildProps(schema, logicalData);

    await notion.pages.update({
        page_id: pageId,
        properties: props
    });

    return { ...data, userId };
}

export async function listUsers(): Promise<User[]> {
    if (isSupabaseBackend()) {
        const rows = (await supabaseRest("/profiles?select=*")) as SupabaseProfileRow[];
        return rows.map(mapSupabaseProfileToUser);
    }

    const dbId = getDatabaseId(DB_KEY);
    const response = await notion.databases.query({
        database_id: dbId,
    });
    return response.results.map((page: any) => {
        const props = page.properties;

        // Robust reading
        let availability = getSelectValue(props.availability_hours_per_week);
        if (!availability && props.availability_hours_per_week?.number) {
            availability = normalizeAvailability(props.availability_hours_per_week.number);
        }

        return {
            id: page.id,
            userId: getTextValue(props.user_id),
            email: props.email?.email || "",
            username: getTextValue(props.username) || "Unknown",
            publicCode: fallbackPublicCodeFromUserId(getTextValue(props.user_id)),
            passwordHash: getTextValue(props.password_hash),
            country: getSelectValue(props.country),
            language: getSelectValue(props.language),
            skills: props.skills?.multi_select?.map((o: any) => o.name) || [],
            availabilityHours: availability,
            availabilityStart: props.availability_start?.date?.start,
            bio: getTextValue(props.bio),
            portfolioLinks: getTextValue(props.portfolio_links)?.split("\n").filter(Boolean) || [],
        };
    });
}

export async function listUsersByUserIds(userIds: string[]): Promise<User[]> {
    const normalizedIds = Array.from(
        new Set(userIds.map((userId) => String(userId || "").trim()).filter(Boolean))
    );
    if (!normalizedIds.length) return [];

    if (isSupabaseBackend()) {
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

    const all = await listUsers();
    const set = new Set(normalizedIds);
    const map = new Map(all.map((user) => [user.userId, user]));
    return normalizedIds.map((id) => map.get(id)).filter((user): user is User => Boolean(user && set.has(user.userId)));
}

export async function deleteUserAccount(userId: string) {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId) {
        throw new Error("User ID is required.");
    }

    if (isSupabaseBackend()) {
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
        return;
    }

    const dbId = getDatabaseId(DB_KEY);
    const response = await notion.databases.query({
        database_id: dbId,
        filter: {
            property: "user_id",
            rich_text: { equals: normalizedUserId },
        },
        page_size: 1,
    });
    const page = (response.results as any[])[0];
    if (!page?.id) return;

    await notion.pages.update({
        page_id: page.id,
        archived: true,
    });
}
