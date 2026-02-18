import { NextResponse } from "next/server";
import { getDatabaseSchema, assertDatabaseHasProperties } from "@/lib/notion-schema";
import { getDatabaseId } from "@/lib/notion-client";

export const runtime = "nodejs";

const SCHEMA_REQUIREMENTS: any = {
    // DB_KEY: { required_columns... }
    "NOTION_DB_USERS": {
        email: "email",
        password_hash: "rich_text",
        username: "title",
        country: "select",
        language: "select",
        skills: "multi_select",
        availability_hours_per_week: "select",
        availability_start: "date",
        portfolio_links: "rich_text",
        bio: "rich_text",
    },
    // Add others if needed for strict check
    "NOTION_DB_TEAMS": {
        // team_name (title) - auto checked
        team_id: "rich_text",
        visibility: "select",
        primary_owner_user_id: "rich_text",
    }
};

export async function GET() {
    const results: any = { ok: true, details: {} };

    try {
        for (const [dbKey, requirements] of Object.entries(SCHEMA_REQUIREMENTS)) {
            const dbId = getDatabaseId(dbKey);
            try {
                const schema = await getDatabaseSchema(dbId);
                // Basic Assertion
                assertDatabaseHasProperties(schema, requirements as any);
                results.details[dbKey] = "OK";
            } catch (error: any) {
                results.ok = false;
                results.details[dbKey] = error.message;
            }
        }
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }

    return NextResponse.json(results, { status: results.ok ? 200 : 500 });
}
