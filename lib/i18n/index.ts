import { APP_LANGUAGES, AppLanguage, DEFAULT_LANGUAGE, MESSAGES } from "@/lib/i18n/messages";
import { MESSAGE_OVERRIDES } from "@/lib/i18n/overrides";

const APP_LANGUAGE_SET = new Set<string>(APP_LANGUAGES);
const LANGUAGE_ALIAS: Record<string, AppLanguage> = {
    kr: "ko",
    ko: "ko",
    korean: "ko",
    "\ud55c\uad6d\uc5b4": "ko",
    "\ud55c\uad6d\ub9d0": "ko",
    "\ud55c\uad6d": "ko",
    jp: "ja",
    ja: "ja",
    japanese: "ja",
    "\uc77c\ubcf8\uc5b4": "ja",
    "\u65e5\u672c\u8a9e": "ja",
    en: "en",
    eng: "en",
    english: "en",
    "\uc601\uc5b4": "en",
    fr: "fr",
    fra: "fr",
    fre: "fr",
    french: "fr",
    francais: "fr",
    "fran\u00e7ais": "fr",
    "\ud504\ub791\uc2a4\uc5b4": "fr",
    es: "es",
    spa: "es",
    spanish: "es",
    espanol: "es",
    "espa\u00f1ol": "es",
    "\uc2a4\ud398\uc778\uc5b4": "es",
};

type TranslateParams = Record<string, string | number>;

const HANGUL_REGEX = /[\uac00-\ud7a3]/u;
const CJK_IDEOGRAPH_REGEX = /[\u3400-\u9fff]/u;
const REPLACEMENT_CHAR_REGEX = /\uFFFD/u;
const SUSPICIOUS_QUESTION_REGEX = /\?(?:\?|[^\s.,!?)}\]])/u;

function formatTemplate(template: string, params?: TranslateParams): string {
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, key: string) => {
        if (!Object.prototype.hasOwnProperty.call(params, key)) {
            return `{${key}}`;
        }
        return String(params[key]);
    });
}

export function normalizeLanguage(input: string | null | undefined): AppLanguage {
    const raw = String(input || "").trim().toLowerCase();
    if (!raw) return DEFAULT_LANGUAGE;

    if (LANGUAGE_ALIAS[raw]) return LANGUAGE_ALIAS[raw];

    const sanitized = raw.replace(/[_\s]+/g, "-");
    if (LANGUAGE_ALIAS[sanitized]) return LANGUAGE_ALIAS[sanitized];

    if (APP_LANGUAGE_SET.has(raw)) {
        return raw as AppLanguage;
    }
    if (APP_LANGUAGE_SET.has(sanitized)) {
        return sanitized as AppLanguage;
    }

    const primary = raw.split("-")[0];
    const primarySanitized = sanitized.split("-")[0];
    if (APP_LANGUAGE_SET.has(primary)) {
        return primary as AppLanguage;
    }
    if (APP_LANGUAGE_SET.has(primarySanitized)) {
        return primarySanitized as AppLanguage;
    }
    if (LANGUAGE_ALIAS[primary]) return LANGUAGE_ALIAS[primary];
    if (LANGUAGE_ALIAS[primarySanitized]) return LANGUAGE_ALIAS[primarySanitized];

    return DEFAULT_LANGUAGE;
}

function isCorruptedTemplate(language: AppLanguage, template: string): boolean {
    const normalized = String(template || "");
    if (!normalized) return true;
    if (REPLACEMENT_CHAR_REGEX.test(normalized)) return true;

    if (language === "ko") {
        if (CJK_IDEOGRAPH_REGEX.test(normalized)) return true;
        if (SUSPICIOUS_QUESTION_REGEX.test(normalized)) return true;
        return false;
    }

    if (language === "ja") {
        if (HANGUL_REGEX.test(normalized)) return true;
        if (SUSPICIOUS_QUESTION_REGEX.test(normalized)) return true;
        return false;
    }

    if (language === "fr" || language === "es") {
        if (HANGUL_REGEX.test(normalized)) return true;
    }

    return false;
}

function pickLocalizedMessage(language: AppLanguage, key: string): string | null {
    const localizedOverride = MESSAGE_OVERRIDES[language]?.[key];
    if (localizedOverride && !isCorruptedTemplate(language, localizedOverride)) {
        return localizedOverride;
    }

    const localizedBase = MESSAGES[language]?.[key];
    if (localizedBase && !isCorruptedTemplate(language, localizedBase)) {
        return localizedBase;
    }

    return null;
}

export function resolveMessage(
    language: AppLanguage,
    key: string,
    params?: TranslateParams
): string {
    const localized = pickLocalizedMessage(language, key);
    const englishOverride = MESSAGE_OVERRIDES[DEFAULT_LANGUAGE]?.[key];
    const englishBase = MESSAGES[DEFAULT_LANGUAGE]?.[key];
    const template = localized ?? englishOverride ?? englishBase ?? key;

    return formatTemplate(template, params);
}

