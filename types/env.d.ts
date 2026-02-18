declare namespace NodeJS {
    interface ProcessEnv {
        // App
        NEXT_PUBLIC_APP_NAME: string;
        NEXT_PUBLIC_APP_URL: string;
        DATA_BACKEND?: "notion" | "supabase";

        // Auth
        NEXTAUTH_URL: string;
        NEXTAUTH_SECRET: string;
        BCRYPT_SALT_ROUNDS?: string;

        // Supabase
        SUPABASE_URL?: string;
        SUPABASE_ANON_KEY?: string;
        SUPABASE_SERVICE_ROLE_KEY?: string;

        // OAuth
        GOOGLE_CLIENT_ID?: string;
        GOOGLE_CLIENT_SECRET?: string;
        GITHUB_ID?: string;
        GITHUB_SECRET?: string;
        GITHUB_CLIENT_ID?: string;
        GITHUB_CLIENT_SECRET?: string;

        // Notion Core
        NOTION_TOKEN?: string;
        NOTION_PARENT_PAGE_ID?: string;

        // Notion DBs
        NOTION_DB_USERS?: string;
        NOTION_DB_TEAMS?: string;
        NOTION_DB_TEAM_MEMBERS?: string;
        NOTION_DB_CHAT_REQUESTS?: string;
        NOTION_DB_TEAM_INVITES?: string;
        NOTION_DB_JOIN_REQUESTS?: string;
        NOTION_DB_TEAM_JOIN_REQUESTS?: string;
        NOTION_DB_THREADS?: string;
        NOTION_DB_MESSAGES?: string;
        NOTION_DB_LINKS?: string;
        NOTION_DB_FILES?: string;
        NOTION_DB_COMMENTS?: string;
        NOTION_DB_TASKS?: string;
        NOTION_DB_MEETING_NOTES?: string;
        NOTION_DB_AGREEMENT_NOTES?: string;

        // Email
        SMTP_HOST?: string;
        SMTP_PORT?: string;
        SMTP_USER?: string;
        SMTP_PASS?: string;
        SMTP_FROM?: string;
        EMAIL_ENABLED?: string; // "true" | "false"

        // Rate Limiting
        DAILY_CHAT_REQUEST_LIMIT?: string;
        DAILY_TEAM_INVITE_LIMIT?: string;

        // File Storage
        FILE_STORAGE_DRIVER?: string;
        MAX_FILE_SIZE_MB?: string;
        ALLOWED_FILE_TYPES?: string;

        // Translation
        TRANSLATION_PROVIDER?: string;
        TRANSLATION_API_KEY?: string;

        // Logging
        LOG_LEVEL?: string;
    }
}
