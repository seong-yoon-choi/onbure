"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { reportClientError } from "@/lib/monitoring/client-errors";
import { normalizeLanguage, resolveMessage } from "@/lib/i18n";
import { AppLanguage, DEFAULT_LANGUAGE } from "@/lib/i18n/messages";
import { applyDomLiteralTranslations } from "@/lib/i18n/dom-translate";

const THEME_STORAGE_KEY = "onbure.theme";
const LANGUAGE_STORAGE_KEY = "onbure.language";
const CLIENT_ERROR_DEDUPE_WINDOW_MS = 15000;
const CLIENT_ERROR_DEDUPE_MAX_SIZE = 150;

export type Theme = "light" | "dark";

interface ThemeContextValue {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

interface LanguageContextValue {
    language: AppLanguage;
    setLanguage: (language: AppLanguage | string) => void;
    t: (key: string, params?: Record<string, string | number>) => string;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const LanguageContext = createContext<LanguageContextValue | null>(null);

function applyTheme(theme: Theme) {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
}

export function Providers({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isAuthRoute = pathname === "/login" || pathname === "/register";
    const recentClientErrorMapRef = useRef<Map<string, number>>(new Map());
    const originalTextMapRef = useRef<WeakMap<Text, string>>(new WeakMap());
    const domTranslateRafRef = useRef<number | null>(null);
    const domTranslateApplyingRef = useRef(false);
    const [theme, setThemeState] = useState<Theme>(() => {
        if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
            return "dark";
        }
        return "light";
    });
    const [language, setLanguageState] = useState<AppLanguage>(DEFAULT_LANGUAGE);

    useEffect(() => {
        const rootTheme: Theme = document.documentElement.classList.contains("dark") ? "dark" : "light";

        let nextTheme = rootTheme;
        try {
            const stored = localStorage.getItem(THEME_STORAGE_KEY);
            if (stored === "light" || stored === "dark") {
                nextTheme = stored;
            } else {
                localStorage.setItem(THEME_STORAGE_KEY, "light");
            }
        } catch {
            nextTheme = rootTheme;
        }

        setThemeState(nextTheme);
    }, []);

    useEffect(() => {
        let nextLanguage = DEFAULT_LANGUAGE;
        try {
            const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
            if (storedLanguage) {
                nextLanguage = normalizeLanguage(storedLanguage);
            } else if (typeof navigator !== "undefined") {
                nextLanguage = normalizeLanguage(navigator.language);
            }
        } catch {
            if (typeof navigator !== "undefined") {
                nextLanguage = normalizeLanguage(navigator.language);
            }
        }

        setLanguageState(nextLanguage);
    }, []);

    useEffect(() => {
        const nextTheme: Theme = isAuthRoute ? "light" : theme;
        applyTheme(nextTheme);
        if (!isAuthRoute) {
            try {
                localStorage.setItem(THEME_STORAGE_KEY, theme);
            } catch {
                // Ignore localStorage errors (private mode / blocked storage).
            }
        }
    }, [isAuthRoute, theme]);

    useEffect(() => {
        document.documentElement.lang = language;
        try {
            localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
        } catch {
            // Ignore localStorage errors (private mode / blocked storage).
        }
    }, [language]);

    useEffect(() => {
        if (typeof document === "undefined" || !document.body) return;

        const applyTranslations = () => {
            domTranslateApplyingRef.current = true;
            try {
                applyDomLiteralTranslations(document.body, language, originalTextMapRef.current);
            } finally {
                domTranslateApplyingRef.current = false;
            }
        };

        applyTranslations();

        const observer = new MutationObserver(() => {
            if (domTranslateApplyingRef.current) return;
            if (domTranslateRafRef.current !== null) return;
            domTranslateRafRef.current = window.requestAnimationFrame(() => {
                domTranslateRafRef.current = null;
                applyTranslations();
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ["placeholder", "title", "aria-label"],
        });

        return () => {
            observer.disconnect();
            if (domTranslateRafRef.current !== null) {
                window.cancelAnimationFrame(domTranslateRafRef.current);
                domTranslateRafRef.current = null;
            }
        };
    }, [language]);

    useEffect(() => {
        const shouldReport = (key: string) => {
            const now = Date.now();
            const dedupeMap = recentClientErrorMapRef.current;
            const lastAt = dedupeMap.get(key);
            if (lastAt && now - lastAt < CLIENT_ERROR_DEDUPE_WINDOW_MS) {
                return false;
            }

            dedupeMap.set(key, now);
            if (dedupeMap.size > CLIENT_ERROR_DEDUPE_MAX_SIZE) {
                const staleCutoff = now - CLIENT_ERROR_DEDUPE_WINDOW_MS;
                for (const [entryKey, entryAt] of dedupeMap.entries()) {
                    if (entryAt < staleCutoff) dedupeMap.delete(entryKey);
                }
                if (dedupeMap.size > CLIENT_ERROR_DEDUPE_MAX_SIZE) {
                    const oldest = dedupeMap.entries().next().value as [string, number] | undefined;
                    if (oldest?.[0]) dedupeMap.delete(oldest[0]);
                }
            }

            return true;
        };

        const onError = (event: ErrorEvent) => {
            const message = String(event.message || "window.error");
            const source = String(event.filename || "window.error");
            const key = `${message}:${source}:${String(event.lineno || 0)}`;
            if (!shouldReport(key)) return;

            void reportClientError({
                message,
                stack: event.error instanceof Error ? event.error.stack : undefined,
                source,
                context: {
                    lineno: event.lineno,
                    colno: event.colno,
                },
            });
        };

        const onUnhandledRejection = (event: PromiseRejectionEvent) => {
            const reason = event.reason;
            const message =
                reason instanceof Error
                    ? reason.message
                    : typeof reason === "string"
                        ? reason
                        : "Unhandled promise rejection";
            const key = `unhandled:${String(message).slice(0, 180)}`;
            if (!shouldReport(key)) return;

            void reportClientError({
                message: String(message || "Unhandled promise rejection"),
                stack: reason instanceof Error ? reason.stack : undefined,
                source: "unhandledrejection",
            });
        };

        window.addEventListener("error", onError);
        window.addEventListener("unhandledrejection", onUnhandledRejection);
        return () => {
            window.removeEventListener("error", onError);
            window.removeEventListener("unhandledrejection", onUnhandledRejection);
        };
    }, []);

    const setTheme = useCallback((nextTheme: Theme) => {
        setThemeState(nextTheme);
    }, []);

    const setLanguage = useCallback((nextLanguage: AppLanguage | string) => {
        setLanguageState(normalizeLanguage(nextLanguage));
    }, []);

    const t = useCallback((key: string, params?: Record<string, string | number>) => {
        return resolveMessage(language, key, params);
    }, [language]);

    const themeValue = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
    const languageValue = useMemo(
        () => ({ language, setLanguage, t }),
        [language, setLanguage, t]
    );

    return (
        <SessionProvider>
            <ThemeContext.Provider value={themeValue}>
                <LanguageContext.Provider value={languageValue}>{children}</LanguageContext.Provider>
            </ThemeContext.Provider>
        </SessionProvider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within Providers");
    }
    return context;
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error("useLanguage must be used within Providers");
    }
    return context;
}
