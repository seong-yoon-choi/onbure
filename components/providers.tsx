"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { SessionProvider } from "next-auth/react";
import { reportClientError } from "@/lib/monitoring/client-errors";

const THEME_STORAGE_KEY = "onbure.theme";
const CLIENT_ERROR_DEDUPE_WINDOW_MS = 15000;
const CLIENT_ERROR_DEDUPE_MAX_SIZE = 150;

export type Theme = "light" | "dark";

interface ThemeContextValue {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
}

export function Providers({ children }: { children: React.ReactNode }) {
    const recentClientErrorMapRef = useRef<Map<string, number>>(new Map());
    const [theme, setThemeState] = useState<Theme>(() => {
        if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
            return "dark";
        }
        return "light";
    });

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
        applyTheme(nextTheme);
    }, []);

    useEffect(() => {
        applyTheme(theme);
        try {
            localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch {
            // Ignore localStorage errors (private mode / blocked storage).
        }
    }, [theme]);

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

    const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

    return (
        <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
            <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
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
