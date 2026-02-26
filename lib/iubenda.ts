export type IubendaLegalSection = "terms" | "privacy" | "cookie" | "marketing";

export interface IubendaCookieConfig {
    siteId: string;
    cookiePolicyId: string;
    lang: string;
}

function readPublicEnv(key: string): string | null {
    const value = String(process.env[key] || "").trim();
    return value ? value : null;
}

export function isIubendaEnabled(): boolean {
    const raw = readPublicEnv("NEXT_PUBLIC_IUBENDA_ENABLED");
    return raw === "true" || raw === "1";
}

export function getIubendaWidgetScriptUrl(): string | null {
    return readPublicEnv("NEXT_PUBLIC_IUBENDA_WIDGET_SCRIPT_URL");
}

export function getIubendaCookieConfig(): IubendaCookieConfig | null {
    const siteId = readPublicEnv("NEXT_PUBLIC_IUBENDA_SITE_ID");
    const cookiePolicyId = readPublicEnv("NEXT_PUBLIC_IUBENDA_COOKIE_POLICY_ID");
    if (!siteId || !cookiePolicyId) return null;

    return {
        siteId,
        cookiePolicyId,
        lang: readPublicEnv("NEXT_PUBLIC_IUBENDA_LANG") || "en",
    };
}

export function shouldLoadIubendaScripts(): boolean {
    return isIubendaEnabled() && Boolean(getIubendaCookieConfig());
}

export function shouldLoadIubendaEmbedLoader(): boolean {
    if (!isIubendaEnabled()) return false;

    const privacy = getIubendaLegalUrl("privacy");
    const cookie = getIubendaLegalUrl("cookie");
    const terms = getIubendaLegalUrl("terms");
    const widget = getIubendaWidgetScriptUrl();

    return Boolean(privacy || cookie || terms || widget);
}

export function getIubendaLegalUrl(section: IubendaLegalSection): string | null {
    const keyBySection: Record<IubendaLegalSection, string> = {
        terms: "NEXT_PUBLIC_IUBENDA_TERMS_URL",
        privacy: "NEXT_PUBLIC_IUBENDA_PRIVACY_URL",
        cookie: "NEXT_PUBLIC_IUBENDA_COOKIE_URL",
        marketing: "NEXT_PUBLIC_IUBENDA_MARKETING_URL",
    };
    return readPublicEnv(keyBySection[section]);
}

export function buildIubendaConfigScript(config: IubendaCookieConfig): string {
    const scriptConfig = {
        siteId: Number.parseInt(config.siteId, 10) || config.siteId,
        cookiePolicyId: Number.parseInt(config.cookiePolicyId, 10) || config.cookiePolicyId,
        lang: config.lang,
        storage: { useSiteId: true },
    };
    return `window._iub = window._iub || {}; window._iub.csConfiguration = ${JSON.stringify(scriptConfig)};`;
}
