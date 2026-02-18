export const NOTION_VERSION = "2022-06-28";
export const NOTION_API_BASE = "https://api.notion.com/v1";
const DATA_BACKEND = String(process.env.DATA_BACKEND || "notion").trim().toLowerCase();
const NOTION_ENABLED = DATA_BACKEND !== "supabase";
const NOTION_TOKEN = process.env.NOTION_TOKEN || "";

if (NOTION_ENABLED && !NOTION_TOKEN) {
    throw new Error("Missing NOTION_TOKEN");
}

const headers = {
    "Authorization": `Bearer ${NOTION_TOKEN}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
};

// Log verified DB IDs (Partial for security)
const logEnv = (key: string) => {
    const val = process.env[key];
    return val ? `...${val.slice(-6)}` : "MISSING";
};

if (process.env.NODE_ENV !== "production") {
    if (NOTION_ENABLED) {
        console.log(`[EnvCheck] DB_USERS=${logEnv("NOTION_DB_USERS")} DB_TEAMS=${logEnv("NOTION_DB_TEAMS")} DB_TEAM_MEMBERS=${logEnv("NOTION_DB_TEAM_MEMBERS")} DB_THREADS=${logEnv("NOTION_DB_THREADS")} DB_AGREEMENT_NOTES=${logEnv("NOTION_DB_AGREEMENT_NOTES")}`);
    } else {
        console.log("[EnvCheck] DATA_BACKEND=supabase (Notion runtime disabled)");
    }
}

async function notionRequest(endpoint: string, method: string, body?: any) {
    if (!NOTION_ENABLED) {
        throw new Error("Notion backend is disabled (DATA_BACKEND=supabase).");
    }
    if (!NOTION_TOKEN) {
        throw new Error("Missing NOTION_TOKEN");
    }

    const maxAttempts = 3;
    let lastStatus = 0;
    let lastText = "";

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const res = await fetch(`${NOTION_API_BASE}${endpoint}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            cache: "no-store",
        });

        if (res.ok) {
            return res.json();
        }

        lastStatus = res.status;
        lastText = await res.text();

        if (res.status !== 429 || attempt >= maxAttempts - 1) {
            break;
        }

        const retryAfterRaw = res.headers.get("retry-after");
        const retryAfterSeconds = Number.parseFloat(retryAfterRaw || "");
        const baseDelayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
            ? Math.round(retryAfterSeconds * 1000)
            : 400 * (2 ** attempt);
        const jitterMs = Math.floor(Math.random() * 120);
        const delayMs = Math.min(baseDelayMs + jitterMs, 5000);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw new Error(`Notion API Error [${lastStatus}]: ${lastText}`);
}

// REST Wrappers
export const notion = {
    databases: {
        query: async (args: { database_id: string; filter?: any; sorts?: any; page_size?: number }) => {
            return notionRequest(`/databases/${args.database_id}/query`, "POST", {
                filter: args.filter,
                sorts: args.sorts,
                page_size: args.page_size,
            });
        },
        retrieve: async (databaseId: string) => {
            return notionRequest(`/databases/${databaseId}`, "GET");
        },
    },
    pages: {
        create: async (args: { parent: { database_id: string }; properties: any }) => {
            return notionRequest(`/pages`, "POST", {
                parent: args.parent,
                properties: args.properties,
            });
        },
        update: async (args: { page_id: string; properties?: any; archived?: boolean }) => {
            return notionRequest(`/pages/${args.page_id}`, "PATCH", {
                properties: args.properties,
                archived: args.archived,
            });
        },
        retrieve: async (pageId: string) => {
            return notionRequest(`/pages/${pageId}`, "GET");
        }
    },
};

export const getDatabaseId = (key: keyof NodeJS.ProcessEnv | string[]) => {
    if (!NOTION_ENABLED) {
        if (Array.isArray(key)) {
            for (const k of key) {
                if (process.env[k]) return process.env[k]!;
            }
            return "";
        }
        return process.env[key] || "";
    }

    if (Array.isArray(key)) {
        for (const k of key) {
            if (process.env[k]) return process.env[k]!;
        }
        throw new Error(`Missing environment variable: ${key.join(" or ")}`);
    }

    const id = process.env[key];
    if (!id) {
        throw new Error(`Missing environment variable: ${key}`);
    }
    return id;
};

export const getSelectValue = (property: any) => {
    return property?.select?.name || property?.status?.name || null;
};

export const getTextValue = (property: any) => {
    if (property?.title) {
        return property.title.map((t: any) => t.plain_text).join("");
    }
    if (property?.rich_text) {
        return property.rich_text.map((t: any) => t.plain_text).join("");
    }
    return "";
};
