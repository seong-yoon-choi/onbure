"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/modal";
import { X } from "lucide-react";

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
const STAGE_LABELS: Record<(typeof STAGE_OPTIONS)[number], string> = {
    idea: "Idea",
    mvp: "MVP",
    beta: "Beta",
    launched: "Launched",
};
const WORK_STYLE_LABELS: Record<(typeof WORK_STYLE_OPTIONS)[number], string> = {
    async: "Async",
    sync: "Sync",
    hybrid: "Hybrid",
};
const VISIBILITY_LABELS: Record<(typeof VISIBILITY_OPTIONS)[number], string> = {
    private: "Private",
    public: "Public",
};
const WORK_STYLE_HELP_ITEMS = [
    {
        label: "Async",
        description: "Progress does not require everyone online at the same time.",
        example: "Leave decisions in docs/Notion and teammates respond later.",
    },
    {
        label: "Sync",
        description: "Work happens together in scheduled real-time sessions.",
        example: "Run 2-3 meetings/calls per week for immediate decisions.",
    },
    {
        label: "Hybrid",
        description: "Default to async and use sync only for key decisions.",
        example: "One weekly meeting, everything else in docs/chat.",
    },
] as const;
const LANGUAGE_OPTIONS = [
    { value: "ko", label: "Korean" },
    { value: "en", label: "English" },
    { value: "ja", label: "Japanese" },
] as const;

export default function CreateTeamModal({ open, onClose, onCreated }: CreateTeamModalProps) {
    const [step, setStep] = useState<1 | 2>(1);
    const [teamName, setTeamName] = useState("");
    const [description, setDescription] = useState("");
    const [stage, setStage] = useState<(typeof STAGE_OPTIONS)[number]>("idea");
    const [timezone, setTimezone] = useState("UTC");

    const [language, setLanguage] = useState<(typeof LANGUAGE_OPTIONS)[number]["value"]>("ko");
    const [teamSize, setTeamSize] = useState<number>(1);
    const [openSlots, setOpenSlots] = useState<number>(0);
    const [openSlotsInput, setOpenSlotsInput] = useState<string>("0");
    const [commitmentHoursPerWeek, setCommitmentHoursPerWeek] = useState<(typeof COMMITMENT_OPTIONS)[number]>("6-10");
    const [workStyle, setWorkStyle] = useState<(typeof WORK_STYLE_OPTIONS)[number]>("hybrid");
    const [showWorkStyleHelp, setShowWorkStyleHelp] = useState(false);
    const [visibility, setVisibility] = useState<(typeof VISIBILITY_OPTIONS)[number]>("private");
    const [roleInput, setRoleInput] = useState("");
    const [recruitingRoles, setRecruitingRoles] = useState<string[]>([]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [isCreateConfirmOpen, setIsCreateConfirmOpen] = useState(false);

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
        setShowWorkStyleHelp(false);
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
        setShowWorkStyleHelp(false);
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
            setError("Team name is required.");
            return;
        }

        setIsSubmitting(true);
        setError("");
        setShowWorkStyleHelp(false);

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
                setError(data.error || "Failed to create team.");
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
            setError("Failed to create team.");
            setIsSubmitting(false);
        }
    };

    const requestCreateConfirm = () => {
        if (isSubmitting) return;
        const normalizedName = teamName.trim().replace(/\s+/g, " ");
        if (!normalizedName) {
            setError("Team name is required.");
            return;
        }
        setIsCreateConfirmOpen(true);
    };

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 backdrop-blur-sm px-4"
            onMouseDown={(event) => {
                if (!isSubmitting && event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] shadow-2xl">
                <div className="px-5 py-4 border-b border-[var(--border)]">
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="text-base font-semibold text-[var(--fg)]">Create Team</h3>
                        <span className="text-xs text-[var(--muted)]">Step {step} / 2</span>
                    </div>
                    <p className="text-xs text-[var(--muted)] mt-1">
                        {step === 1 ? "Essential team info" : "Optional team profile info"}
                    </p>
                </div>

                <div className="px-5 py-4 space-y-3 min-h-[380px]">
                    {step === 1 && (
                        <>
                            <div className="space-y-1">
                                <label className="text-xs text-[var(--muted)]">Team Name *</label>
                                <input
                                    value={teamName}
                                    onChange={(event) => setTeamName(event.target.value)}
                                    maxLength={60}
                                    className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                                    placeholder="e.g. Product Design Squad"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-[var(--muted)]">Team Description (max 300)</label>
                                <textarea
                                    value={description}
                                    onChange={(event) => setDescription(event.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
                                    rows={6}
                                    className="w-full h-40 resize-none overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                                    placeholder="Describe your team goals, product direction, and what kind of collaborators you need."
                                />
                                <div className="text-[10px] text-[var(--muted)] text-right">
                                    {description.length}/{MAX_DESCRIPTION_LENGTH}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs text-[var(--muted)]">Stage</label>
                                    <select
                                        value={stage}
                                        onChange={(event) => setStage(event.target.value as (typeof STAGE_OPTIONS)[number])}
                                        className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                                    >
                                        {STAGE_OPTIONS.map((option) => (
                                            <option key={option} value={option}>
                                                {STAGE_LABELS[option]}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs text-[var(--muted)]">Time Zone</label>
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
                                <label className="text-xs text-[var(--muted)]">Team Language</label>
                                <select
                                    value={language}
                                    onChange={(event) => setLanguage(event.target.value as (typeof LANGUAGE_OPTIONS)[number]["value"])}
                                    className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                                >
                                    {LANGUAGE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs text-[var(--muted)]">Current Members</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={teamSize}
                                        readOnly
                                        className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--muted)] focus:outline-none"
                                    />
                                    <p className="text-[10px] text-[var(--muted)]">Starts with the creator (1 member).</p>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs text-[var(--muted)]">Max People</label>
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
                                    <label className="text-xs text-[var(--muted)]">Weekly Commitment</label>
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
                                    <label className="text-xs text-[var(--muted)]">Visibility</label>
                                    <select
                                        value={visibility}
                                        onChange={(event) => setVisibility(event.target.value as (typeof VISIBILITY_OPTIONS)[number])}
                                        className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                                    >
                                        {VISIBILITY_OPTIONS.map((option) => (
                                            <option key={option} value={option}>
                                                {VISIBILITY_LABELS[option]}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                    <label className="text-xs text-[var(--muted)]">Work Style</label>
                                    <button
                                        type="button"
                                        aria-label="Work style guide"
                                        onClick={() => setShowWorkStyleHelp((prev) => !prev)}
                                        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border)] text-[10px] font-semibold text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--fg)]"
                                    >
                                        !
                                    </button>
                                </div>
                                <select
                                    value={workStyle}
                                    onChange={(event) => setWorkStyle(event.target.value as (typeof WORK_STYLE_OPTIONS)[number])}
                                    className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                                >
                                    {WORK_STYLE_OPTIONS.map((option) => (
                                        <option key={option} value={option}>
                                            {WORK_STYLE_LABELS[option]}
                                        </option>
                                    ))}
                                </select>
                                {showWorkStyleHelp && (
                                    <div className="rounded-md border border-[var(--border)] bg-[var(--input-bg)] p-2 text-[11px] text-[var(--muted)] space-y-1.5">
                                        {WORK_STYLE_HELP_ITEMS.map((item) => (
                                            <p key={item.label}>
                                                <span className="text-[var(--fg)]">{item.label}</span>: {item.description}
                                                <br />
                                                Example: {item.example}
                                            </p>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-[var(--muted)]">Recruiting Roles</label>
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
                                        placeholder="e.g. Frontend Engineer"
                                    />
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={addRole}
                                        disabled={!canAddRole}
                                        className="h-9"
                                    >
                                        Add
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
                                                    aria-label={`Remove ${role}`}
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
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => setStep(2)}
                                disabled={!canGoNext || isSubmitting}
                            >
                                Next
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
                                Back
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                onClick={requestCreateConfirm}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? "Creating..." : "Create"}
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <ConfirmModal
                open={isCreateConfirmOpen}
                title="Create Team"
                message="정말 만드시겠습니까?"
                confirmLabel={isSubmitting ? "Creating..." : "Create"}
                cancelLabel="취소"
                isProcessing={isSubmitting}
                onCancel={() => setIsCreateConfirmOpen(false)}
                onConfirm={() => {
                    setIsCreateConfirmOpen(false);
                    void submit();
                }}
            />
        </div>
    );
}




