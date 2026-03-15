import sharedOverridesData from "@/lib/i18n/shared-overrides.json";
import { ADMIN_PAGE_OVERRIDES } from "@/lib/i18n/admin-page-overrides";
import { AUTH_ADMIN_OVERRIDES } from "@/lib/i18n/auth-admin-overrides";
import { AppLanguage } from "@/lib/i18n/messages";
import { WORKSPACE_OVERRIDES } from "@/lib/i18n/workspace-overrides";

type MessageTable = Record<string, string>;

const SHARED_OVERRIDES = sharedOverridesData as Record<AppLanguage, MessageTable>;

export const MESSAGE_OVERRIDES: Record<AppLanguage, MessageTable> = {
    ko: {
        ...SHARED_OVERRIDES.ko,
        ...WORKSPACE_OVERRIDES.ko,
        ...ADMIN_PAGE_OVERRIDES.ko,
        ...AUTH_ADMIN_OVERRIDES.ko,
    },
    ja: {
        ...SHARED_OVERRIDES.ja,
        ...WORKSPACE_OVERRIDES.ja,
        ...ADMIN_PAGE_OVERRIDES.ja,
        ...AUTH_ADMIN_OVERRIDES.ja,
    },
    en: {
        ...SHARED_OVERRIDES.en,
        ...WORKSPACE_OVERRIDES.en,
        ...ADMIN_PAGE_OVERRIDES.en,
        ...AUTH_ADMIN_OVERRIDES.en,
    },
    fr: {
        ...SHARED_OVERRIDES.fr,
        ...WORKSPACE_OVERRIDES.fr,
        ...ADMIN_PAGE_OVERRIDES.fr,
        ...AUTH_ADMIN_OVERRIDES.fr,
    },
    es: {
        ...SHARED_OVERRIDES.es,
        ...WORKSPACE_OVERRIDES.es,
        ...ADMIN_PAGE_OVERRIDES.es,
        ...AUTH_ADMIN_OVERRIDES.es,
    },
};
