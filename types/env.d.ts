declare namespace NodeJS {
    interface ProcessEnv {
        // App
        NEXT_PUBLIC_APP_NAME: string;
        NEXT_PUBLIC_APP_URL: string;
        DATA_BACKEND?: "supabase";
        NEXT_PUBLIC_IUBENDA_ENABLED?: string;
        NEXT_PUBLIC_IUBENDA_SITE_ID?: string;
        NEXT_PUBLIC_IUBENDA_COOKIE_POLICY_ID?: string;
        NEXT_PUBLIC_IUBENDA_LANG?: string;
        NEXT_PUBLIC_IUBENDA_TERMS_URL?: string;
        NEXT_PUBLIC_IUBENDA_PRIVACY_URL?: string;
        NEXT_PUBLIC_IUBENDA_COOKIE_URL?: string;
        NEXT_PUBLIC_IUBENDA_MARKETING_URL?: string;
        NEXT_PUBLIC_IUBENDA_WIDGET_SCRIPT_URL?: string;

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

        // Email
        RESEND_API_KEY?: string;
        EMAIL_FROM?: string;
        SMTP_FROM?: string; // Legacy fallback for email sender
        EMAIL_VERIFICATION_SECRET?: string;
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
