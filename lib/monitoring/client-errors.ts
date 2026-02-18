"use client";

interface ReportClientErrorInput {
    message: string;
    stack?: string;
    source?: string;
    path?: string;
    context?: Record<string, unknown>;
}

function toSafeText(value: unknown, maxLength: number) {
    return String(value || "").trim().slice(0, maxLength);
}

export async function reportClientError(input: ReportClientErrorInput) {
    const message = toSafeText(input.message, 500);
    if (!message) return;

    try {
        await fetch("/api/monitoring/errors", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message,
                stack: toSafeText(input.stack, 4000),
                source: toSafeText(input.source, 120),
                path: toSafeText(input.path || window.location.pathname, 500),
                context: input.context || {},
            }),
        });
    } catch {
        // Avoid recursive logging loops on network failures.
    }
}

