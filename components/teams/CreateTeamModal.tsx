"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/modal";
import { X } from "lucide-react";
import { useLanguage } from "@/components/providers";
import { resolveTeamApiErrorMessage } from "@/lib/i18n/team-api-errors";

interface CreateTeamModalProps {
    open: boolean;
    onClose: () => void;
    onCreated?: (teamId: string) => void;
}

const MAX_DESCRIPTION_LENGTH = 300;
const COMMON_TIMEZONES = ["UTC", "Asia/Seoul", "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Tokyo"];
const STAGE_OPTIONS = ["idea", "mvp", "beta", "launched"] as const;
const COMMITMENT_OPTIONS = ["1-5", "6-10", "11-20", "21-40", "40+"] as const;
const WORK_STYLE_OPTIONS = ["async", "sync", "hybrid"] as const;
const VISIBILITY_OPTIONS = ["private", "public"] as const;
const LANGUAGE_OPTIONS = ["ko", "ja", "en", "fr", "es"] as const;

export default function CreateTeamModal({ open, onClose, onCreated }: CreateTeamModalProps) {
    const { t } = useLanguage();
    const [step, setStep] = useState<1 | 2>(1);
    const [teamName, setTeamName] = useState("");
    const [description, setDescription] = useState("");
    const [stage, setStage] = useState<(typeof STAGE_OPTIONS)[number]>("idea");
    const [timezone, setTimezone] = useState("UTC");

    const [language, setLanguage] = useState<(typeof LANGUAGE_OPTIONS)[number]>("ko");
    const [teamSize, setTeamSize] = useState<number>(1);
    const [openSlots, setOpenSlots] = useState<number>(0);
    const [openSlotsInput, setOpenSlotsInput] = useState<string>("0");
    const [commitmentHoursPerWeek, setCommitmentHoursPerWeek] = useState<(typeof COMMITMENT_OPTIONS)[number]>("6-10");
    const [workStyle, setWorkStyle] = useState<(typeof WORK_STYLE_OPTIONS)[number]>("hybrid");
    const [workStyleTooltip, setWorkStyleTooltip] = useState<{ x: number; y: number } | null>(null);
    const [visibility, setVisibility] = useState<(typeof VISIBILITY_OPTIONS)[number]>("private");
    const [roleInput, setRoleInput] = useState("");
    const [recruitingRoles, setRecruitingRoles] = useState<string[]>([]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [isCreateConfirmOpen, setIsCreateConfirmOpen] = useState(false);

    const stageLabels = useMemo<Record<(typeof STAGE_OPTIONS)[number], string>>(
        () => ({
            idea: t("team.stage.idea"),
            mvp: t("team.stage.mvp"),
            beta: t("team.stage.beta"),
            launched: t("team.stage.launched"),
        }),
        [t]
    );
    const workStyleLabels = useMemo<Record<(typeof WORK_STYLE_OPTIONS)[number], string>>(
        () => ({
            async: t("team.workStyle.async"),
            sync: t("team.workStyle.sync"),
            hybrid: t("team.workStyle.hybrid"),
        }),
        [t]
    );
    const visibilityLabels = useMemo<Record<(typeof VISIBILITY_OPTIONS)[number], string>>(
        () => ({
            private: t("visibility.private"),
            public: t("visibility.public"),
        }),
        [t]
    );
    const languageLabels = useMemo<Record<(typeof LANGUAGE_OPTIONS)[number], string>>(
        () => ({
            ko: t("language.korean"),
            ja: t("language.japanese"),
            en: t("language.english"),
            fr: t("language.french"),
            es: t("language.spanish"),
        }),
        [t]
    );
    const workStyleHelpItems = useMemo(
        () => [
            {
                label: t("team.workStyle.async"),
                description: t("team.workStyle.async.description"),
                example: t("team.workStyle.async.example"),
            },
            {
                label: t("team.workStyle.sync"),
                description: t("team.workStyle.sync.description"),
                example: t("team.workStyle.sync.example"),
            },
            {
                label: t("team.workStyle.hybrid"),
                description: t("team.workStyle.hybrid.description"),
                example: t("team.workStyle.hybrid.example"),
            },
        ],
        [t]
    );

    useEffect(() => {
        if (!open) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !isSubmitting) {
                if (isCreateConfirmOpen) {
                    setIsCreateConfirmOpen(false);
                    return;
                }
                onClose();
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, isSubmitting, isCreateConfirmOpen, onClose]);

    useEffect(() => {
        if (!open) return;
        setError("");
        setWorkStyleTooltip(null);
        const inferredTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (typeof inferredTimezone === "string" && inferredTimezone.trim()) {
            setTimezone(inferredTimezone.trim());
        }
    }, [open]);

    useEffect(() => {
        if (!open) {
            setIsCreateConfirmOpen(false);
        }
    }, [open]);

    const canAddRole = useMemo(() => roleInput.trim().length > 0, [roleInput]);

    const canGoNext = useMemo(() => teamName.trim().length > 0, [teamName]);

    const addRole = () => {
        const value = roleInput.trim().replace(/\s+/g, " ");
        if (!value) return;
        if (recruitingRoles.some((role) => role.toLowerCase() === value.toLowerCase())) {
            setRoleInput("");
            return;
        }

        setRecruitingRoles((prev) => [...prev, value]);
        setRoleInput("");
    };

    const removeRole = (target: string) => {
        setRecruitingRoles((prev) => prev.filter((role) => role !== target));
    };

    const resetForm = () => {
        setStep(1);
        setTeamName("");
        setDescription("");
        setStage("idea");
        setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");

        setLanguage("ko");
        setTeamSize(1);
        setOpenSlots(0);
        setOpenSlotsInput("0");
        setCommitmentHoursPerWeek("6-10");
        setWorkStyle("hybrid");
        setWorkStyleTooltip(null);
        setVisibility("private");
        setRoleInput("");
        setRecruitingRoles([]);

        setIsSubmitting(false);
        setError("");
        setIsCreateConfirmOpen(false);
    };

    const submit = async () => {
        if (isSubmitting) return;

        const normalizedName = teamName.trim().replace(/\s+/g, " ");
        if (!normalizedName) {
            setError(t("createTeam.error.nameRequired"));
            return;
        }

        setIsSubmitting(true);
        setError("");
        setWorkStyleTooltip(null);

        try {
            const res = await fetch("/api/teams", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    teamName: normalizedName,
                    description: description.trim(),
                    stage,
                    timezone: timezone.trim(),
                    teamSize,
                    openSlots,
                    commitmentHoursPerWeek,
                    workStyle,
                    visibility,
                    language,
                    recruitingRoles,
                }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(resolveTeamApiErrorMessage(data?.error, t, "createTeam.error.failed"));
                setIsSubmitting(false);
                return;
            }

            if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("onbure-teams-updated"));
            }

            const createdTeamId = String(data.teamId || "");
            resetForm();
            onClose();
            if (createdTeamId) {
                onCreated?.(createdTeamId);
            }
        } catch (e) {
            console.error(e);
            setError(t("createTeam.error.failed"));
            setIsSubmitting(false);
        }
    };

    const requestCreateConfirm = () => {
        if (isSubmitting) return;
        const normalizedName = teamName.trim().replace(/\s+/g, " ");
        if (!normalizedName) {
            setError(t("createTeam.error.nameRequired"));
            return;
        }
        setIsCreateConfirmOpen(true);
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 backdrop-blur-sm px-4">
            <div className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] shadow-2xl">
                <div className="px-5 py-4 border-b border-[var(--border)]">
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="text-base font-semibold text-[var(--fg)]">{t("createTeam.title")}</h3>
                        <span className="text-xs text-[var(--muted)]">
                            {t("createTeam.stepIndicator", { current: step, total: 2 })}
                        </span>
                    </div>
                    <p className="text-xs text-[var(--muted)] mt-1">
                        {step === 1 ? t("createTeam.step1Description") : t("createTeam.step2Description")}
                    </p>
                </div>

                <div className="px-5 py-4 space-y-3 min-h-[380px]">
                    {step === 1 && (
                        <>
                            <div className="space-y-1">
                                <label className="text-xs text-[var(--muted)]">{t("createTeam.field.name")}</label>
                                <input
                                    value={teamName}
                                    onChange={(event) => setTeamName(event.target.value)}
                                    maxLength={60}
                                    className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                                    placeholder={t("createTeam.placeholder.name")}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-[var(--muted)]">{t("createTeam.field.description")}</label>
                                <textarea
                                    value={description}
                                    onChange={(event) => setDescription(event.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
                                    rows={6}
                                    className="w-full h-40 resize-none overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                                    placeholder={t("createTeam.placeholder.description")}
                                />
                                <div className="text-[10px] text-[var(--muted)] text-right">
                                    {description.length}/{MAX_DESCRIPTION_LENGTH}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs text-[var(--muted)]">{t("team.field.stage")}</label>
                                    <select
                                        value={stage}
                                        onChange={(event) => setStage(event.target.value as (typeof STAGE_OPTIONS)[number])}
                                        className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                                    >
                                        {STAGE_OPTIONS.map((option) => (
                                            <option key={option} value={option}>
                                                {stageLabels[option]}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs text-[var(--muted)]">{t("team.field.timeZone")}</label>
                                    <select
                                        value={timezone}
                                        onChange={(event) => setTimezone(event.target.value)}
                                        className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                                    >
                                        {[timezone, ...COMMON_TIMEZONES.filter((option) => option !== timezone)].map((option) => (
                                            <option key={option} value={option}>
                                                {option}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <div className="space-y-1">
                                <label className="text-xs text-[var(--muted)]">{t("team.field.teamLanguage")}</label>
                                <select
                                    value={language}
                                    onChange={(event) => setLanguage(event.target.value as (typeof LANGUAGE_OPTIONS)[number])}
                                    className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                                >
                                    {LANGUAGE_OPTIONS.map((option) => (
                                        <option key={option} value={option}>
                                            {languageLabels[option]}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs text-[var(--muted)]">{t("team.field.currentMembers")}</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={teamSize}
                                        readOnly
                                        className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--muted)] focus:outline-none"
                                    />
                                    <p className="text-[10px] text-[var(--muted)]">{t("createTeam.currentMembersHint")}</p>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs text-[var(--muted)]">{t("team.field.maxPeople")}</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={openSlotsInput}
                                        onChange={(event) => {
                                            const digitsOnly = event.target.value.replace(/\D/g, "");
                                            if (!digitsOnly) {
                                                setOpenSlots(0);
                                                setOpenSlotsInput("");
                                                return;
                                            }
                                            const normalized = String(Number.parseInt(digitsOnly, 10));
                                            setOpenSlots(Number(normalized));
                                            setOpenSlotsInput(normalized);
                                        }}
                                        onBlur={() => {
                                            if (openSlotsInput === "") {
                                                setOpenSlotsInput("0");
                                                return;
                                            }
                                            setOpenSlotsInput(String(openSlots));
                                        }}
                                        className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs text-[var(--muted)]">{t("team.field.weeklyCommitment")}</label>
                                    <select
                                        value={commitmentHoursPerWeek}
                                        onChange={(event) =>
                                            setCommitmentHoursPerWeek(event.target.value as (typeof COMMITMENT_OPTIONS)[number])
                                        }
                                        className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                                    >
                                        {COMMITMENT_OPTIONS.map((option) => (
                                            <option key={option} value={option}>
                                                {option}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs text-[var(--muted)]">{t("team.field.visibility")}</label>
                                    <select
                                        value={visibility}
                                        onChange={(event) => setVisibility(event.target.value as (typeof VISIBILITY_OPTIONS)[number])}
                                        className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                                    >
                                        {VISIBILITY_OPTIONS.map((option) => (
                                            <option key={option} value={option}>
                                                {visibilityLabels[option]}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                    <label className="text-xs text-[var(--muted)]">{t("team.field.workStyle")}</label>
                                    <span className="group relative inline-flex h-4 w-4 items-center justify-center">
                                        <button
                                            type="button"
                                            aria-label={t("team.workStyleGuideAria")}
                                            onMouseEnter={(event) => {
                                                const rect = event.currentTarget.getBoundingClientRect();
                                                setWorkStyleTooltip({ x: rect.right + 8, y: rect.top + rect.height / 2 });
                                            }}
                                            onMouseMove={(event) => {
                                                const rect = event.currentTarget.getBoundingClientRect();
                                                setWorkStyleTooltip({ x: rect.right + 8, y: rect.top + rect.height / 2 });
                                            }}
                                            onMouseLeave={() => setWorkStyleTooltip(null)}
                                            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border)] text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--fg)]"
                                        >
                                            !
                                        </button>
                                    </span>
                                </div>
                                <select
                                    value={workStyle}
                                    onChange={(event) => setWorkStyle(event.target.value as (typeof WORK_STYLE_OPTIONS)[number])}
                                    className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                                >
                                    {WORK_STYLE_OPTIONS.map((option) => (
                                        <option key={option} value={option}>
                                            {workStyleLabels[option]}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-[var(--muted)]">{t("team.field.recruitingRoles")}</label>
                                <div className="flex gap-2">
                                    <input
                                        value={roleInput}
                                        onChange={(event) => setRoleInput(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                event.preventDefault();
                                                addRole();
                                            }
                                        }}
                                        className="flex-1 h-9 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                                        placeholder={t("team.rolePlaceholder")}
                                    />
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={addRole}
                                        disabled={!canAddRole}
                                        className="h-9"
                                    >
                                        {t("common.add")}
                                    </Button>
                                </div>

                                {recruitingRoles.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {recruitingRoles.map((role) => (
                                            <span
                                                key={role}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-[var(--border)] text-xs text-[var(--fg)] bg-[var(--card-bg-hover)]"
                                            >
                                                {role}
                                                <button
                                                    type="button"
                                                    aria-label={`${t("common.remove")} ${role}`}
                                                    className="text-[var(--muted)] hover:text-[var(--fg)]"
                                                    onClick={() => removeRole(role)}
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {error && <p className="text-xs text-rose-500">{error}</p>}
                </div>

                <div className="px-5 py-4 border-t border-[var(--border)] flex items-center justify-between gap-2">
                    {step === 1 ? (
                        <>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    if (isSubmitting) return;
                                    resetForm();
                                    onClose();
                                }}
                                disabled={isSubmitting}
                            >
                                {t("common.cancel")}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => setStep(2)}
                                disabled={!canGoNext || isSubmitting}
                            >
                                {t("createTeam.next")}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setStep(1)}
                                disabled={isSubmitting}
                            >
                                {t("createTeam.back")}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                onClick={requestCreateConfirm}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? t("createTeam.creating") : t("createTeam.create")}
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <ConfirmModal
                open={isCreateConfirmOpen}
                title={t("createTeam.title")}
                message={t("createTeam.confirmMessage")}
                confirmLabel={isSubmitting ? t("createTeam.creating") : t("createTeam.create")}
                cancelLabel={t("common.cancel")}
                isProcessing={isSubmitting}
                onCancel={() => setIsCreateConfirmOpen(false)}
                onConfirm={() => {
                    setIsCreateConfirmOpen(false);
                    void submit();
                }}
            />
            {workStyleTooltip && (
                <div
                    className="pointer-events-none fixed z-[90] max-w-[320px] rounded border border-[var(--border)] bg-[var(--card-bg)] px-2.5 py-1.5 text-xs text-[var(--fg)] shadow-md"
                    style={{ left: workStyleTooltip.x, top: workStyleTooltip.y, transform: "translateY(-50%)" }}
                >
                    {workStyleHelpItems.map((item) => (
                        <div key={item.label} className="mb-1 last:mb-0">
                            <span className="text-[var(--fg)]">{item.label}</span>: {item.description}
                            <br />
                            {t("team.workStyle.examplePrefix")}: {item.example}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}




