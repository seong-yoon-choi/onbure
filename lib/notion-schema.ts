const REMOVED_BACKEND_ERROR =
    "Legacy schema adapter has been removed. Use Supabase schema directly.";

export async function getDatabaseSchema(
    _databaseId: string,
    _options?: { forceRefresh?: boolean }
): Promise<any> {
    void _databaseId;
    void _options;
    throw new Error(REMOVED_BACKEND_ERROR);
}

export function getTitlePropertyName(schema: any): string {
    const props = schema?.properties || {};
    for (const key in props) {
        if (props[key].type === "title") {
            return key;
        }
    }
    throw new Error("No title property found in schema.");
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
