"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart3, CircleHelp } from "lucide-react";
import { useLanguage } from "@/components/providers";

interface AdminEntry {
    entry_id: string;
    type: string;
    title: string;
    content: string;
    author_name: string;
    created_at: string;
    answered_at: string | null;
    answer_content: string | null;
    profiles?: { email: string };
}

type AdminTab = "qna" | "feedback" | "click_stats";

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

function normalizeTab(value: string | null | undefined): AdminTab {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "feedback") return "feedback";
    if (normalized === "click_stats") return "click_stats";
    return "qna";
}

function buildAdminQnaHref(tab: AdminTab) {
    if (tab === "qna") return "/admin/qna";
    return `/admin/qna?tab=${encodeURIComponent(tab)}`;
}

function AdminQnaContent() {
    const { t, language } = useLanguage();
    const router = useRouter();
    const searchParams = useSearchParams();
    const locale = useMemo(() => getIntlLocale(language), [language]);

    const resolvedTab = useMemo(() => normalizeTab(searchParams.get("tab")), [searchParams]);

    const [tab, setTab] = useState<AdminTab>(resolvedTab);
    const [entries, setEntries] = useState<AdminEntry[]>([]);
    const [entriesLoading, setEntriesLoading] = useState(true);
    const [entriesLoadError, setEntriesLoadError] = useState("");
    const [uxStats, setUxStats] = useState<AdminUxStatsResponse | null>(null);
    const [uxStatsLoading, setUxStatsLoading] = useState(false);
    const [uxStatsLoadError, setUxStatsLoadError] = useState("");

    useEffect(() => {
        setTab(resolvedTab);
    }, [resolvedTab]);

    useEffect(() => {
        if (tab === "click_stats") {
            setEntriesLoading(false);
            return;
        }

        setEntriesLoading(true);
        setEntriesLoadError("");

        const loadEntries = async () => {
            try {
                const response = await fetch(`/api/admin/qna?type=${tab}&limit=200`, { cache: "no-store" });
                const payload = await response.json().catch(() => ({} as { entries?: AdminEntry[] }));
                if (!response.ok) {
                    throw new Error(t("adminQna.loadFailed"));
                }
                setEntries(Array.isArray(payload?.entries) ? payload.entries : []);
            } catch (error) {
                console.error("Error fetching admin qna list:", error);
                setEntries([]);
                setEntriesLoadError(error instanceof Error ? error.message : t("adminQna.loadFailed"));
            } finally {
                setEntriesLoading(false);
            }
        };

        void loadEntries();
    }, [tab, t]);

    useEffect(() => {
        if (tab !== "click_stats") return;

        setUxStatsLoading(true);
        setUxStatsLoadError("");

        const loadUxStats = async () => {
            try {
                const response = await fetch("/api/admin/ux-click-stats", { cache: "no-store" });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(t("adminQna.stats.loadFailed"));
                }

                setUxStats({
                    summary: {
                        totalClicks: Number(payload?.summary?.totalClicks || 0),
                        actionsTracked: Number(payload?.summary?.actionsTracked || 0),
                        activeAreas: Number(payload?.summary?.activeAreas || 0),
                        lastClickedAt: payload?.summary?.lastClickedAt ? String(payload.summary.lastClickedAt) : null,
                        generatedAt: String(payload?.summary?.generatedAt || new Date().toISOString()),
                    },
                    areas: Array.isArray(payload?.areas)
                        ? payload.areas.map((area: any) => ({
                            area: String(area?.area || ""),
                            totalClicks: Number(area?.totalClicks || 0),
                            actions: Array.isArray(area?.actions)
                                ? area.actions.map((action: any) => ({
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
                console.error("Error fetching admin click stats:", error);
                setUxStats(null);
                setUxStatsLoadError(error instanceof Error ? error.message : t("adminQna.stats.loadFailed"));
            } finally {
                setUxStatsLoading(false);
            }
        };

        void loadUxStats();
    }, [tab, t]);

    const handleTabChange = (nextTab: AdminTab) => {
        setTab(nextTab);
        router.replace(buildAdminQnaHref(nextTab));
    };

    return (
        <div className="max-w-5xl mx-auto py-8">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <CircleHelp className="w-6 h-6 text-[var(--primary)]" />
                {t("adminQna.title")}
            </h1>

            <div className="flex items-center gap-2 mb-6 border-b border-[var(--border)] pb-2">
                <button
                    onClick={() => handleTabChange("qna")}
                    className={`px-4 py-2 font-medium rounded-t-md transition-colors ${tab === "qna" ? "text-[var(--primary)] border-b-2 border-[var(--primary)]" : "text-[var(--muted)] hover:text-[var(--fg)]"}`}
                >
                    {t("adminQna.tabQuestions")}
                </button>
                <button
                    onClick={() => handleTabChange("feedback")}
                    className={`px-4 py-2 font-medium rounded-t-md transition-colors ${tab === "feedback" ? "text-[var(--primary)] border-b-2 border-[var(--primary)]" : "text-[var(--muted)] hover:text-[var(--fg)]"}`}
                >
                    {t("adminQna.tabFeedback")}
                </button>
                <button
                    onClick={() => handleTabChange("click_stats")}
                    className={`px-4 py-2 font-medium rounded-t-md transition-colors ${tab === "click_stats" ? "text-[var(--primary)] border-b-2 border-[var(--primary)]" : "text-[var(--muted)] hover:text-[var(--fg)]"}`}
                >
                    {t("adminQna.tabClickStats")}
                </button>
            </div>

            {tab === "click_stats" ? (
                <div className="space-y-4">
                    {uxStatsLoading ? (
                        <div className="p-8 text-center text-[var(--muted)]">{t("adminQna.stats.loading")}</div>
                    ) : (
                        <>
                            {uxStatsLoadError && (
                                <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
                                    {uxStatsLoadError}
                                </div>
                            )}
                            {!uxStats || uxStats.areas.length === 0 ? (
                                <div className="text-center py-10 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg text-[var(--muted)]">
                                    {t("adminQna.stats.empty")}
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-4">
                                            <p className="text-xs text-[var(--muted)] mb-1">{t("adminQna.stats.totalClicks")}</p>
                                            <p className="text-xl font-semibold">{formatMetric(uxStats.summary.totalClicks, locale)}</p>
                                        </div>
                                        <div className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-4">
                                            <p className="text-xs text-[var(--muted)] mb-1">{t("adminQna.stats.actionsTracked")}</p>
                                            <p className="text-xl font-semibold">{formatMetric(uxStats.summary.actionsTracked, locale)}</p>
                                        </div>
                                        <div className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-4">
                                            <p className="text-xs text-[var(--muted)] mb-1">{t("adminQna.stats.activeAreas")}</p>
                                            <p className="text-xl font-semibold">{formatMetric(uxStats.summary.activeAreas, locale)}</p>
                                        </div>
                                        <div className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-4">
                                            <p className="text-xs text-[var(--muted)] mb-1">{t("adminQna.stats.lastClick")}</p>
                                            <p className="text-sm font-medium">{formatDateTime(uxStats.summary.lastClickedAt, locale, t("adminQna.stats.never"))}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {uxStats.areas.map((area) => (
                                            <Link
                                                key={area.area}
                                                href={`/admin/qna/click-stats/${encodeURIComponent(area.area)}`}
                                                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-4 py-3 flex items-center justify-between transition-colors hover:bg-[var(--card-bg-hover)]"
                                            >
                                                <div className="min-w-0">
                                                    <p className="font-medium truncate">{translateAreaLabel(area.area, t)}</p>
                                                    <p className="text-xs text-[var(--muted)] mt-0.5">
                                                        {t("adminQna.stats.areaActionCount", {
                                                            count: formatMetric(area.actions.length, locale),
                                                        })}
                                                    </p>
                                                </div>
                                                <div className="inline-flex items-center gap-2">
                                                    <BarChart3 className="w-4 h-4 text-[var(--muted)]" />
                                                    <span className="text-sm font-semibold">
                                                        {formatMetric(area.totalClicks, locale)}
                                                    </span>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {entriesLoading ? (
                        <div className="p-8 text-center text-[var(--muted)]">{t("adminQna.loading")}</div>
                    ) : (
                        <>
                            {entriesLoadError && (
                                <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
                                    {entriesLoadError}
                                </div>
                            )}

                            {entries.length === 0 ? (
                                <div className="text-center py-10 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg text-[var(--muted)]">
                                    {t("adminQna.empty", {
                                        type: tab === "qna" ? t("adminQna.type.qna") : t("adminQna.type.feedback"),
                                    })}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {entries.map((entry) => (
                                        <Link
                                            key={entry.entry_id}
                                            href={`/admin/qna/entries/${encodeURIComponent(entry.entry_id)}?type=${encodeURIComponent(tab)}`}
                                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-4 py-3 flex items-center justify-between gap-3 transition-colors hover:bg-[var(--card-bg-hover)]"
                                        >
                                            <span className="font-medium truncate">{entry.title || t("adminQna.untitled")}</span>
                                            <span
                                                className={`text-xs font-semibold px-2 py-1 rounded ${entry.answered_at ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}
                                            >
                                                {entry.answered_at
                                                    ? t("adminQna.listStatus.answered")
                                                    : t("adminQna.listStatus.needsReply")}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function AdminQnaLoadingFallback() {
    const { t } = useLanguage();
    return <div className="p-8 text-center text-[var(--muted)]">{t("common.loading")}</div>;
}

export default function AdminQnaPage() {
    return (
        <Suspense fallback={<AdminQnaLoadingFallback />}>
            <AdminQnaContent />
        </Suspense>
    );
}
