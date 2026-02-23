"use client";

type UxContext = Record<string, unknown>;

export function trackUxClick(actionKey: string, context?: UxContext) {
    const normalizedActionKey = String(actionKey || "").trim();
    if (!normalizedActionKey) return;

    const payload = {
        actionKey: normalizedActionKey,
        context: context && typeof context === "object" ? context : {},
    };

    try {
        void fetch("/api/ux/click", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            keepalive: true,
        });
    } catch {
        // UX logging must never block user actions.
    }
}
