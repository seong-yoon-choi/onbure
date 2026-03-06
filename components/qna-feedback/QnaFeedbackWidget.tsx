"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { CircleHelp, X, Paperclip } from "lucide-react";
import { useLanguage } from "@/components/providers";

interface QnaFeedbackWidgetProps {
    isOpen: boolean;
    onClose: () => void;
    teamId?: string;
    authorName?: string;
}

type SubmissionType = "qna" | "feedback";

const PANEL_WIDTH_DESKTOP = 700;
const PANEL_HEIGHT_DESKTOP = 600;
const PANEL_MIN_WIDTH = 360;
const PANEL_MIN_HEIGHT = 480;
const VIEWPORT_PADDING = 16;
const TOPBAR_SAFE_MARGIN = 80;
const MAX_FILE_SIZE_MB = 25;

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

export default function QnaFeedbackWidget({
    isOpen,
    onClose,
    teamId,
    authorName,
}: QnaFeedbackWidgetProps) {
    const { t } = useLanguage();
    const [tab, setTab] = useState<SubmissionType>("qna");
    const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({
        width: 0,
        height: 0,
    });

    const [qnaTitleDraft, setQnaTitleDraft] = useState("");
    const [qnaBodyDraft, setQnaBodyDraft] = useState("");
    const [feedbackTitleDraft, setFeedbackTitleDraft] = useState("");
    const [feedbackBodyDraft, setFeedbackBodyDraft] = useState("");
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const normalizedAuthorName = String(authorName || "").trim() || t("workspace.unknown");
    const isQnaTab = tab === "qna";
    const titleDraft = isQnaTab ? qnaTitleDraft : feedbackTitleDraft;
    const bodyDraft = isQnaTab ? qnaBodyDraft : feedbackBodyDraft;

    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleResize = () => {
            setViewportSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };
        handleResize();
        if (!isOpen) return;
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [isOpen]);

    const panelSize = useMemo(() => {
        const fallbackWidth =
            typeof window !== "undefined" ? window.innerWidth : PANEL_WIDTH_DESKTOP + VIEWPORT_PADDING * 2;
        const fallbackHeight =
            typeof window !== "undefined" ? window.innerHeight : PANEL_HEIGHT_DESKTOP + TOPBAR_SAFE_MARGIN;
        const viewportWidth = viewportSize.width > 0 ? viewportSize.width : fallbackWidth;
        const viewportHeight = viewportSize.height > 0 ? viewportSize.height : fallbackHeight;

        const maxAllowedWidth = Math.max(PANEL_MIN_WIDTH, viewportWidth - VIEWPORT_PADDING * 2);
        const maxAllowedHeight = Math.max(PANEL_MIN_HEIGHT, viewportHeight - TOPBAR_SAFE_MARGIN - VIEWPORT_PADDING);

        return {
            width: Math.min(PANEL_WIDTH_DESKTOP, maxAllowedWidth),
            height: Math.min(PANEL_HEIGHT_DESKTOP, maxAllowedHeight),
        };
    }, [viewportSize.height, viewportSize.width]);

    const panelPosition = useMemo(() => {
        const fallbackWidth =
            typeof window !== "undefined" ? window.innerWidth : panelSize.width + VIEWPORT_PADDING * 2;
        const fallbackHeight =
            typeof window !== "undefined" ? window.innerHeight : panelSize.height + VIEWPORT_PADDING * 2;
        const viewportWidth = viewportSize.width > 0 ? viewportSize.width : fallbackWidth;
        const viewportHeight = viewportSize.height > 0 ? viewportSize.height : fallbackHeight;

        if (viewportWidth <= 0 || viewportHeight <= 0) {
            return { x: VIEWPORT_PADDING, y: TOPBAR_SAFE_MARGIN };
        }

        const maxX = Math.max(VIEWPORT_PADDING, viewportWidth - panelSize.width - VIEWPORT_PADDING);
        const maxY = Math.max(TOPBAR_SAFE_MARGIN, viewportHeight - panelSize.height - VIEWPORT_PADDING);

        const x = (viewportWidth - panelSize.width) / 2;
        const y = (viewportHeight - panelSize.height) / 2;

        return {
            x: clamp(Math.round(x), VIEWPORT_PADDING, maxX),
            y: clamp(Math.round(y), TOPBAR_SAFE_MARGIN, maxY),
        };
    }, [panelSize.height, panelSize.width, viewportSize.height, viewportSize.width]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            window.alert(t("workspace.qna.fileTooLarge", { maxSize: MAX_FILE_SIZE_MB }));
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }
        setAttachedFile(file);
    };

    const clearFile = () => {
        setAttachedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const createSubmission = async (type: SubmissionType) => {
        const title = (type === "qna" ? qnaTitleDraft : feedbackTitleDraft).trim().slice(0, 120);
        const content = (type === "qna" ? qnaBodyDraft : feedbackBodyDraft).trim().slice(0, 2000);
        if (!title || !content || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append("type", type);
            formData.append("title", title);
            formData.append("content", content);
            if (teamId) formData.append("teamId", teamId);
            if (normalizedAuthorName) formData.append("authorName", normalizedAuthorName);
            if (attachedFile) formData.append("file", attachedFile);

            const response = await fetch("/api/workspace/qna-feedback", {
                method: "POST",
                body: formData,
            });

            const payload = await response.json().catch(() => ({} as Record<string, unknown>));
            if (!response.ok) {
                throw new Error(t("workspace.qna.submitFailed"));
            }

            if (type === "qna") {
                setQnaTitleDraft("");
                setQnaBodyDraft("");
            } else {
                setFeedbackTitleDraft("");
                setFeedbackBodyDraft("");
            }
            clearFile();

            if (payload?.emailWarning && typeof window !== "undefined") {
                window.alert(t("workspace.qna.emailWarning"));
            }
        } catch (error) {
            const message =
                error instanceof Error && error.message
                    ? error.message
                    : t("workspace.qna.submitFailed");
            if (typeof window !== "undefined") {
                window.alert(message);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed z-[51] flex flex-col overflow-hidden rounded-lg border shadow-xl"
            style={{
                left: `${panelPosition.x}px`,
                top: `${panelPosition.y}px`,
                width: `${panelSize.width}px`,
                height: `${panelSize.height}px`,
                borderColor: "var(--border)",
                backgroundColor: "var(--card-bg)",
            }}
        >
            <div
                className="flex h-[46px] items-center gap-2 border-b px-3"
                style={{ borderColor: "var(--border)", background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
                <CircleHelp className="h-4 w-4" />
                <p className="text-sm font-semibold">{t("workspace.qnaFeedback")}</p>
                <div className="ml-auto flex items-center">
                    <button
                        type="button"
                        className="text-white/90 hover:text-white"
                        onClick={onClose}
                        aria-label={t("chat.closeAria")}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div className="min-h-0 flex flex-1 flex-col p-3">
                <div className="flex min-h-0 flex-1 flex-col gap-3">
                    <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-[var(--fg)]">{t("workspace.qna.title")}</p>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setTab("qna")}
                                    className={
                                        isQnaTab
                                            ? "rounded-md border border-[var(--primary)] bg-[var(--card-bg-hover)] px-2 py-1 text-xs font-medium text-[var(--primary)] transition-colors"
                                            : "rounded-md border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--card-bg-hover)]"
                                    }
                                >
                                    {t("workspace.qna.tab")}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTab("feedback")}
                                    className={
                                        !isQnaTab
                                            ? "rounded-md border border-[var(--primary)] bg-[var(--card-bg-hover)] px-2 py-1 text-xs font-medium text-[var(--primary)] transition-colors"
                                            : "rounded-md border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--card-bg-hover)]"
                                    }
                                >
                                    {t("workspace.feedback.tab")}
                                </button>
                            </div>
                        </div>
                        <input
                            value={titleDraft}
                            onChange={(event) => {
                                if (isQnaTab) setQnaTitleDraft(event.target.value);
                                else setFeedbackTitleDraft(event.target.value);
                            }}
                            className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-2 text-sm text-[var(--fg)] focus:outline-none"
                            placeholder={t("workspace.qna.formTitlePlaceholder")}
                        />
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col space-y-1">
                        <p className="text-xs font-semibold text-[var(--fg)]">{t("workspace.qna.contentLabel")}</p>
                        <textarea
                            value={bodyDraft}
                            onChange={(event) => {
                                if (isQnaTab) setQnaBodyDraft(event.target.value);
                                else setFeedbackBodyDraft(event.target.value);
                            }}
                            className="min-h-[260px] flex-1 resize-none rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-2 py-2 text-sm text-[var(--fg)] focus:outline-none"
                            placeholder={
                                isQnaTab
                                    ? t("workspace.qna.formBodyPlaceholder")
                                    : t("workspace.feedback.messagePlaceholder")
                            }
                        />
                    </div>

                    <div className="flex flex-col space-y-1">
                        <p className="text-xs font-semibold text-[var(--fg)]">{t("workspace.qna.fileLabel")}</p>
                        <div className="flex flex-col gap-2 rounded-md border border-[var(--border)] bg-[var(--input-bg)] p-2">
                            <div className="flex items-center gap-2">
                                <input
                                    type="file"
                                    id="qna-file-upload"
                                    className="hidden"
                                    onChange={handleFileChange}
                                    ref={fileInputRef}
                                    aria-label={t("workspace.qna.attachFileAria")}
                                />
                                <label
                                    htmlFor="qna-file-upload"
                                    className="flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-2 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--card-bg-hover)] hover:text-[var(--fg)]"
                                >
                                    <Paperclip className="h-3 w-3" />
                                    {t("workspace.qna.attachFile")}
                                </label>
                                {attachedFile && (
                                    <div className="flex flex-1 items-center justify-between min-w-0 rounded bg-[var(--card-bg)] px-2 py-1">
                                        <span className="truncate text-xs text-[var(--fg)]">{attachedFile.name}</span>
                                        <button
                                            type="button"
                                            onClick={clearFile}
                                            className="ml-2 text-[var(--muted)] hover:text-red-500"
                                            aria-label={t("workspace.qna.removeAttachedFileAria")}
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <p className="text-[10px] text-[var(--muted)]">
                                {t("workspace.qna.maxFileSize", { maxSize: MAX_FILE_SIZE_MB })}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="mt-auto w-full rounded-md border border-[var(--primary)] px-2 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--card-bg-hover)]"
                        onClick={() => void createSubmission(isQnaTab ? "qna" : "feedback")}
                        disabled={isSubmitting}
                    >
                        {isSubmitting
                            ? t("common.sending")
                            : isQnaTab
                                ? t("workspace.qna.create")
                                : t("workspace.feedback.create")}
                    </button>
                </div>
            </div>
        </div>
    );
}
