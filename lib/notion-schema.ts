import { notion } from "./notion-client";

// Simple in-memory cache for schema (metadata) to avoid hitting Notion API on every request
// In a serverless env (Vercel), this persists only for the lambda lifetime.
const schemaCache: Record<string, { schema: any; fetchedAt: number }> = {};
const SCHEMA_CACHE_TTL_MS = 30_000;

export async function getDatabaseSchema(databaseId: string, options?: { forceRefresh?: boolean }) {
    const forceRefresh = Boolean(options?.forceRefresh);
    const cached = schemaCache[databaseId];
    const isFresh = cached && Date.now() - cached.fetchedAt < SCHEMA_CACHE_TTL_MS;

    if (!forceRefresh && isFresh) {
        return cached.schema;
    }

    const db = await notion.databases.retrieve(databaseId);
    schemaCache[databaseId] = {
        schema: db,
        fetchedAt: Date.now(),
    };
    return db;
}

export function getTitlePropertyName(schema: any): string {
    const props = schema.properties;
    for (const key in props) {
        if (props[key].type === "title") {
            return key;
        }
    }
    throw new Error(`Database ${schema.id} has no Title property (impossible in Notion)`);
}

export function getPropertyType(schema: any, propName: string): string | null {
    if (!schema.properties[propName]) return null;
    return schema.properties[propName].type;
}

// Requirements map: { "logicalName": "type" }
// Checks if the DB has a property with the given name (or exact match) AND type.
export function assertDatabaseHasProperties(schema: any, requiredProps: Record<string, string>) {
    const missing: string[] = [];
    const mismatch: string[] = [];

    for (const [key, type] of Object.entries(requiredProps)) {
        if (key === "title") {
            // Title is special, we just check if one exists in the DB (implied by getTitlePropertyName usage elsewhere).
            // We don't enforce a strict name "title" or "Name" here because Notion allows renaming it.
            continue;
        }

        const prop = schema.properties[key];
        if (!prop) {
            missing.push(key);
            continue;
        }
        if (prop.type !== type) {
            mismatch.push(`${key} (expected ${type}, got ${prop.type})`);
        }
    }

    if (missing.length > 0 || mismatch.length > 0) {
        throw new Error(
            `Schema Mismatch for DB ${schema.id} ("${schema.title?.[0]?.plain_text || "Untitled"}").\n` +
            `Missing: [${missing.join(", ")}]\n` +
            `Type Mismatch: [${mismatch.join(", ")}]`
        );
    }
}
