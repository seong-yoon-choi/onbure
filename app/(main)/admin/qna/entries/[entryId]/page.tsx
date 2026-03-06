"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, MessageSquare, Reply } from "lucide-react";
import { useLanguage } from "@/components/providers";

type SubmissionType = "qna" | "feedback";

interface AdminEntry {
    entry_id: string;
    type: string;
    title: string;
    content: string;
    author_name: string;
    created_at: string;
    answered_at: string | null;
    answer_content: string | null;
    attached_file_url?: string | null;
    attached_file_name?: string | null;
    profiles?: { email: string };
}

function normalizeSubmissionType(value: string | null | undefined): SubmissionType {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "feedback" ? "feedback" : "qna";
}

function formatDateTime(value: string | null | undefined) {
    const raw = String(value || "").trim();
    if (!raw) return "-";
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return "-";
    return format(parsed, "PPP p");
}

export default function AdminQnaEntryDetailPage() {
    const { t } = useLanguage();
    const params = useParams<{ entryId: string }>();
    const searchParams = useSearchParams();

    const entryIdParam = Array.isArray(params?.entryId) ? params.entryId[0] : params?.entryId;
    const entryId = useMemo(() => decodeURIComponent(String(entryIdParam || "").trim()), [entryIdParam]);
    const type = normalizeSubmissionType(searchParams.get("type"));
    const backHref = `/admin/qna?tab=${encodeURIComponent(type)}`;

    const [entry, setEntry] = useState<AdminEntry | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [replyText, setReplyText] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!entryId) {
            setLoading(false);
            setLoadError(t("adminQna.error.invalidEntryId"));
            return;
        }

        setLoading(true);
        setLoadError("");

        const loadEntry = async () => {
            try {
                const response = await fetch(
                    `/api/admin/qna?entryId=${encodeURIComponent(entryId)}&type=${encodeURIComponent(type)}`,
                    { cache: "no-store" }
                );
                const payload = await response.json().catch(() => ({} as Record<string, unknown>));
                if (!response.ok) {
                    throw new Error(t("adminQna.loadFailed"));
                }

                const nextEntry = payload?.entry as AdminEntry | null;
                if (!nextEntry) {
                    throw new Error(t("adminQna.error.entryNotFound"));
                }

                setEntry(nextEntry);
                setReplyText("");
            } catch (error) {
                console.error("Error fetching admin qna detail:", error);
                setEntry(null);
                setLoadError(error instanceof Error ? error.message : t("adminQna.loadFailed"));
            } finally {
                setLoading(false);
            }
        };

        void loadEntry();
    }, [entryId, t, type]);

    const submitReply = async () => {
        if (!entry || !replyText.trim()) return;
        setIsSubmitting(true);
        try {
            const response = await fetch("/api/admin/qna", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    entryId: entry.entry_id,
                    answerContent: replyText,
                    notifyEmail: entry.profiles?.email || "",
                    entryTitle: entry.title,
                    typeLabel: entry.type,
                }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload?.ok) {
                throw new Error(t("adminQna.alert.submitFailed"));
            }

            const answeredAt = String(payload?.answeredAt || new Date().toISOString());
            setEntry((current) => {
                if (!current) return current;
                return {
                    ...current,
                    answer_content: replyText,
                    answered_at: answeredAt,
                };
            });
            setReplyText("");

            if (payload?.emailWarning) {
                alert(t("adminQna.alert.replySavedEmailFailed", { reason: t("adminQna.alert.emailDeliveryFailed") }));
            }
        } catch (error) {
            console.error("Error saving admin qna reply:", error);
            alert(error instanceof Error ? error.message : t("adminQna.alert.submitError"));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-[var(--muted)]">{t("adminQna.loading")}</div>;
    }

    if (loadError || !entry) {
        return (
            <div className="max-w-4xl mx-auto py-8 space-y-4">
                <Link
                    href={backHref}
                    className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--fg)]"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {t("adminQna.backToList")}
                </Link>
                <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
                    {loadError || t("adminQna.error.entryNotFound")}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-8 space-y-4">
            <Link
                href={backHref}
                className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--fg)]"
            >
                <ArrowLeft className="w-4 h-4" />
                {t("adminQna.backToList")}
            </Link>

            <div className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-5 space-y-4">
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                        <h1 className="text-xl font-semibold">{entry.title || t("adminQna.untitled")}</h1>
                        <span
                            className={`text-xs font-semibold px-2 py-1 rounded ${entry.answered_at ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}
                        >
                            {entry.answered_at
                                ? t("adminQna.listStatus.answered")
                                : t("adminQna.listStatus.needsReply")}
                        </span>
                    </div>
                    <p className="text-xs text-[var(--muted)]">
                        {t("adminQna.userLine", {
                            name: entry.author_name,
                            email: entry.profiles?.email || t("adminQna.noEmail"),
                        })}
                    </p>
                    <p className="text-xs text-[var(--muted)]">{formatDateTime(entry.created_at)}</p>
                </div>

                <div className="bg-[var(--input-bg)] p-3 rounded-md text-sm whitespace-pre-wrap border border-[var(--border)]">
                    {entry.content}
                </div>

                {entry.attached_file_url && (
                    <div className="flex items-center gap-2 p-3 bg-[var(--card-bg-hover)] border border-[var(--border)] rounded-md">
                        <span className="text-sm font-medium text-[var(--fg)]">
                            {t("adminQna.attachedFile")}:
                        </span>
                        <a
                            href={entry.attached_file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-[var(--primary)] hover:underline truncate"
                        >
                            {entry.attached_file_name || entry.attached_file_url.split('/').pop() || t("adminQna.download")}
                        </a>
                    </div>
                )}

                {entry.answer_content && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-md text-sm whitespace-pre-wrap">
                        <div className="text-xs font-bold text-emerald-600 mb-1 flex items-center gap-1">
                            <Reply className="w-3 h-3" />
                            {t("adminQna.replyHeader", { date: formatDateTime(entry.answered_at || entry.created_at) })}
                        </div>
                        {entry.answer_content}
                    </div>
                )}

                <div className="space-y-2">
                    <textarea
                        className="w-full bg-[var(--input-bg)] border border-[var(--border)] rounded-md p-3 text-sm focus:outline-none min-h-[140px]"
                        placeholder={t("adminQna.replyPlaceholder")}
                        value={replyText}
                        onChange={(event) => setReplyText(event.target.value)}
                        disabled={isSubmitting}
                    />
                    <div className="flex items-center justify-end gap-2">
                        <Link
                            href={backHref}
                            className="px-3 py-1.5 text-xs font-medium border border-[var(--border)] rounded text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                        >
                            {t("adminQna.cancel")}
                        </Link>
                        <button
                            type="button"
                            onClick={() => void submitReply()}
                            className="px-3 py-1.5 text-xs font-medium bg-[var(--primary)] text-white rounded hover:bg-[var(--primary)]/90 disabled:opacity-60"
                            disabled={isSubmitting || !replyText.trim()}
                        >
                            <span className="inline-flex items-center gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5" />
                                {isSubmitting ? t("common.sending") : t("adminQna.sendReply")}
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
