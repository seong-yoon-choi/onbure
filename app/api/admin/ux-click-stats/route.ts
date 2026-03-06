import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { supabaseRest } from "@/lib/supabase-rest";

export const runtime = "nodejs";

const AREA_VIEWS = [
    { area: "nav", view: "ux_nav_counts" },
    { area: "discovery", view: "ux_discovery_counts" },
    { area: "friends", view: "ux_friends_counts" },
    { area: "my_team", view: "ux_my_team_counts" },
    { area: "profile", view: "ux_profile_counts" },
] as const;

interface SupabaseUxCountRow {
    action_key?: unknown;
    action_name?: unknown;
    sort_order?: unknown;
    click_count?: unknown;
    last_clicked_at?: unknown;
}

interface AdminUxActionStat {
    actionKey: string;
    actionName: string;
    sortOrder: number;
    clickCount: number;
    lastClickedAt: string | null;
}

interface AdminUxAreaStat {
    area: string;
    totalClicks: number;
    actions: AdminUxActionStat[];
}

function toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeTimestamp(value: unknown): string | null {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email || !isAdmin(session.user.email)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const areas = await Promise.all(
            AREA_VIEWS.map(async ({ area, view }): Promise<AdminUxAreaStat> => {
                const rows = (await supabaseRest(
                    `/${view}?select=action_key,action_name,sort_order,click_count,last_clicked_at&order=sort_order.asc`
                )) as SupabaseUxCountRow[];

                const actions: AdminUxActionStat[] = (Array.isArray(rows) ? rows : [])
                    .map((row) => {
                        const actionKey = String(row?.action_key || "").trim();
                        const actionName = String(row?.action_name || "").trim();
                        const sortOrder = Math.trunc(toNumber(row?.sort_order));
                        const clickCount = Math.max(0, Math.trunc(toNumber(row?.click_count)));
                        const lastClickedAt = normalizeTimestamp(row?.last_clicked_at);
                        return {
                            actionKey,
                            actionName: actionName || actionKey || "",
                            sortOrder,
                            clickCount,
                            lastClickedAt,
                        };
                    })
                    .filter((row) => Boolean(row.actionKey))
                    .sort((left, right) => {
                        if (left.sortOrder !== right.sortOrder) {
                            return left.sortOrder - right.sortOrder;
                        }
                        if (left.clickCount !== right.clickCount) {
                            return right.clickCount - left.clickCount;
                        }
                        return left.actionName.localeCompare(right.actionName);
                    });

                return {
                    area,
                    totalClicks: actions.reduce((sum, action) => sum + action.clickCount, 0),
                    actions,
                };
            })
        );

        let lastClickedAt: string | null = null;
        for (const area of areas) {
            for (const action of area.actions) {
                if (!action.lastClickedAt) continue;
                if (!lastClickedAt || action.lastClickedAt > lastClickedAt) {
                    lastClickedAt = action.lastClickedAt;
                }
            }
        }

        const summary = {
            totalClicks: areas.reduce((sum, area) => sum + area.totalClicks, 0),
            actionsTracked: areas.reduce((sum, area) => sum + area.actions.length, 0),
            activeAreas: areas.filter((area) => area.totalClicks > 0).length,
            lastClickedAt,
            generatedAt: new Date().toISOString(),
        };

        return NextResponse.json({ summary, areas });
    } catch (error) {
        console.error("Failed to fetch admin UX click stats:", error);
        return NextResponse.json({ error: "Failed to fetch click statistics" }, { status: 500 });
    }
}
