"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { SessionProvider } from "next-auth/react";

const THEME_STORAGE_KEY = "onbure.theme";

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

    const setTheme = useCallback((nextTheme: Theme) => {
        setThemeState(nextTheme);
    }, []);

    const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

    return (
        <SessionProvider>
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
