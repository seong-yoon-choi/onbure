"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { useLanguage } from "@/components/providers";

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

interface AdminUxStatsResponse {
    summary: {
        totalClicks: number;
        actionsTracked: number;
        activeAreas: number;
        lastClickedAt: string | null;
        generatedAt: string;
    };
    areas: AdminUxAreaStat[];
}

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

const VALID_AREAS = new Set(["nav", "discovery", "friends", "my_team", "profile"]);
const LOCALE_BY_APP_LANGUAGE: Record<string, string> = {
    ko: "ko-KR",
    ja: "ja-JP",
    en: "en-US",
    fr: "fr-FR",
    es: "es-ES",
};

function getIntlLocale(language: string) {
    return LOCALE_BY_APP_LANGUAGE[language] || LOCALE_BY_APP_LANGUAGE.en;
}

function formatMetric(value: number, locale: string) {
    return new Intl.NumberFormat(locale).format(Math.max(0, Math.trunc(value)));
}

function formatDateTime(value: string | null | undefined, locale: string, emptyLabel: string) {
    const raw = String(value || "").trim();
    if (!raw) return emptyLabel;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return emptyLabel;
    return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(parsed);
}

function translateAreaLabel(area: string, t: TranslateFn) {
    const key = `adminQna.stats.area.${area}`;
    const translated = t(key);
    if (translated !== key) return translated;
    return area;
}

function translateActionLabel(action: AdminUxActionStat, t: TranslateFn) {
    const actionKey = String(action.actionKey || "").trim();
    if (!actionKey) {
        return t("adminQna.stats.unknownAction");
    }

    const directTranslation = t(actionKey);
    if (directTranslation !== actionKey) return directTranslation;

    const scopedKey = `adminQna.stats.action.${actionKey}`;
    const scopedTranslation = t(scopedKey);
    if (scopedTranslation !== scopedKey) return scopedTranslation;

    return t("adminQna.stats.unknownAction");
}

export default function AdminClickStatsAreaDetailPage() {
    const { t, language } = useLanguage();
    const params = useParams<{ area: string }>();
    const locale = useMemo(() => getIntlLocale(language), [language]);

    const areaParam = Array.isArray(params?.area) ? params.area[0] : params?.area;
    const area = useMemo(() => decodeURIComponent(String(areaParam || "").trim()), [areaParam]);

    const [stats, setStats] = useState<AdminUxStatsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");

    useEffect(() => {
        if (!VALID_AREAS.has(area)) {
            setLoading(false);
            setLoadError(t("adminQna.error.invalidCategory"));
            return;
        }

        setLoading(true);
        setLoadError("");

        const loadStats = async () => {
            try {
                const response = await fetch("/api/admin/ux-click-stats", { cache: "no-store" });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(t("adminQna.stats.loadFailed"));
                }

                setStats({
                    summary: {
                        totalClicks: Number(payload?.summary?.totalClicks || 0),
                        actionsTracked: Number(payload?.summary?.actionsTracked || 0),
                        activeAreas: Number(payload?.summary?.activeAreas || 0),
                        lastClickedAt: payload?.summary?.lastClickedAt ? String(payload.summary.lastClickedAt) : null,
                        generatedAt: String(payload?.summary?.generatedAt || new Date().toISOString()),
                    },
                    areas: Array.isArray(payload?.areas)
                        ? payload.areas.map((item: any) => ({
                            area: String(item?.area || ""),
                            totalClicks: Number(item?.totalClicks || 0),
                            actions: Array.isArray(item?.actions)
                                ? item.actions.map((action: any) => ({
                                    actionKey: String(action?.actionKey || ""),
                                    actionName: String(action?.actionName || action?.actionKey || ""),
                                    sortOrder: Number(action?.sortOrder || 0),
                                    clickCount: Number(action?.clickCount || 0),
                                    lastClickedAt: action?.lastClickedAt ? String(action.lastClickedAt) : null,
                                }))
                                : [],
                        }))
                        : [],
                });
            } catch (error) {
                console.error("Error fetching click stat detail:", error);
                setStats(null);
                setLoadError(error instanceof Error ? error.message : t("adminQna.stats.loadFailed"));
            } finally {
                setLoading(false);
            }
        };

        void loadStats();
    }, [area, t]);

    const areaStats = useMemo(() => {
        if (!stats) return null;
        return stats.areas.find((item) => item.area === area) || null;
    }, [area, stats]);

    const areaLastClickedAt = useMemo(() => {
        if (!areaStats) return null;
        let last: string | null = null;
        for (const action of areaStats.actions) {
            if (!action.lastClickedAt) continue;
            if (!last || action.lastClickedAt > last) {
                last = action.lastClickedAt;
            }
        }
        return last;
    }, [areaStats]);

    if (loading) {
        return <div className="p-8 text-center text-[var(--muted)]">{t("adminQna.stats.loading")}</div>;
    }

    if (loadError || !areaStats) {
        return (
            <div className="max-w-4xl mx-auto py-8 space-y-4">
                <Link
                    href="/admin/qna?tab=click_stats"
                    className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--fg)]"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {t("adminQna.stats.backToCategories")}
                </Link>
                <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
                    {loadError || t("adminQna.error.categoryNotFound")}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-8 space-y-4">
            <Link
                href="/admin/qna?tab=click_stats"
                className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--fg)]"
            >
                <ArrowLeft className="w-4 h-4" />
                {t("adminQna.stats.backToCategories")}
            </Link>

                <div className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <h1 className="text-xl font-semibold">{translateAreaLabel(areaStats.area, t)}</h1>
                    <div className="inline-flex items-center gap-2 text-sm font-semibold">
                        <BarChart3 className="w-4 h-4 text-[var(--muted)]" />
                        {formatMetric(areaStats.totalClicks, locale)}
                    </div>
                </div>

                <div className="text-sm text-[var(--muted)]">
                    {t("adminQna.stats.areaSummary", {
                        count: formatMetric(areaStats.actions.length, locale),
                        lastClick: formatDateTime(areaLastClickedAt, locale, t("adminQna.stats.never")),
                    })}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[var(--muted)] border-b border-[var(--border)]">
                                <th className="py-2 pr-4 font-medium">{t("adminQna.stats.table.action")}</th>
                                <th className="py-2 pr-4 font-medium">{t("adminQna.stats.table.key")}</th>
                                <th className="py-2 pr-4 font-medium">{t("adminQna.stats.table.clicks")}</th>
                                <th className="py-2 font-medium">{t("adminQna.stats.table.lastClicked")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {areaStats.actions.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-3 text-[var(--muted)]">
                                        {t("adminQna.stats.emptyArea")}
                                    </td>
                                </tr>
                            ) : (
                                areaStats.actions.map((action) => (
                                    <tr key={action.actionKey} className="border-b border-[var(--border)]/50">
                                        <td className="py-2 pr-4">{translateActionLabel(action, t)}</td>
                                        <td className="py-2 pr-4 font-mono text-xs text-[var(--muted)]">{action.actionKey}</td>
                                        <td className="py-2 pr-4">{formatMetric(action.clickCount, locale)}</td>
                                        <td className="py-2">{formatDateTime(action.lastClickedAt, locale, t("adminQna.stats.never"))}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
