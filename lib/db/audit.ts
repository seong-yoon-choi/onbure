import { isSupabaseBackend } from "@/lib/db/backend";
import { supabaseRest } from "@/lib/supabase-rest";

export type AuditCategory = "chat" | "request" | "workspace" | "team" | "system";
export type AuditScope = "global" | "user" | "team";

export interface AuditLogInput {
    category: AuditCategory;
    event: string;
    actorUserId?: string;
    targetUserId?: string;
    teamId?: string;
    scope?: AuditScope;
    metadata?: Record<string, unknown>;
}

function normalizeText(value: unknown) {
    return String(value || "").trim();
}

function normalizeMetadata(metadata: AuditLogInput["metadata"]) {
    if (!metadata || typeof metadata !== "object") return {};
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
        if (!key) continue;
        if (value === undefined) continue;
        normalized[key] = value;
    }
    return normalized;
}

function resolveScope(input: AuditLogInput): AuditScope {
    if (input.scope) return input.scope;
    if (normalizeText(input.targetUserId)) return "user";
    if (normalizeText(input.teamId)) return "team";
    return "global";
}

export async function appendAuditLog(input: AuditLogInput) {
    if (!isSupabaseBackend()) return;

    const category = normalizeText(input.category);
    const event = normalizeText(input.event);
    if (!category || !event) return;

    try {
        await supabaseRest("/audit_logs", {
            method: "POST",
            prefer: "return=minimal",
            body: {
                category,
                event,
                scope: resolveScope(input),
                actor_user_id: normalizeText(input.actorUserId) || null,
                target_user_id: normalizeText(input.targetUserId) || null,
                team_id: normalizeText(input.teamId) || null,
                metadata: normalizeMetadata(input.metadata),
            },
        });
    } catch (error) {
        console.error("appendAuditLog failed", error);
    }
}

