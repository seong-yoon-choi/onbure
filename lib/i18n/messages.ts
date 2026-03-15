export const APP_LANGUAGES = ["ko", "ja", "en", "fr", "es"] as const;

export type AppLanguage = (typeof APP_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: AppLanguage = "en";

export const LANGUAGE_LABELS_EN: Record<AppLanguage, string> = {
    ko: "Korean",
    ja: "Japanese",
    en: "English",
    fr: "French",
    es: "Spanish",
};

type MessageTable = Record<string, string>;

// Base messages stay intentionally small; localized content is provided by
// generated shared overrides plus curated auth/admin/workspace overrides.
export const MESSAGES: Record<AppLanguage, MessageTable> = {
    ko: {},
    ja: {},
    en: {},
    fr: {},
    es: {},
};
