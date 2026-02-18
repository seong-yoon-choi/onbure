"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/modal";

interface TeamMemberSummary {
    id: string;
    teamId: string;
    userId: string;
    username?: string;
    role: "Owner" | "Admin" | "Member";
    status: "Active" | "Inactive";
    joinedAt: string;
}

interface TeamProfilePayload {
    id: string;
    teamId: string;
    name: string;
    description?: string;
    recruitingRoles?: string[];
    stage?: string;
    timezone?: string;
    teamSize?: number;
    openSlots?: number;
    commitmentHoursPerWeek?: string;
    workStyle?: string;
    visibility: "Public" | "Private";
    language?: string;
    members?: TeamMemberSummary[];
    isMember?: boolean;
    isOwner?: boolean;
}

interface ProfileMenuState {
    x: number;
    y: number;
    userId: string;
}

const STAGE_OPTIONS = ["idea", "mvp", "beta", "launched"] as const;
const COMMITMENT_OPTIONS = ["1-5", "6-10", "11-20", "21-40", "40+"] as const;
const WORK_STYLE_OPTIONS = ["async", "sync", "hybrid"] as const;
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
const VISIBILITY_OPTIONS = ["Public", "Private"] as const;
const COMMON_TIMEZONES = ["UTC", "Asia/Seoul", "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Tokyo"];
const LEAVE_CONFIRM_MESSAGE = "You have unsaved team profile changes. Leave without saving?";

function formatStage(value: string | undefined | null) {
    if (!value) return "-";
    const key = value.toLowerCase() as (typeof STAGE_OPTIONS)[number];
    return STAGE_LABELS[key] || value;
}

function formatWorkStyle(value: string | undefined | null) {
    if (!value) return "-";
    const key = value.toLowerCase() as (typeof WORK_STYLE_OPTIONS)[number];
    return WORK_STYLE_LABELS[key] || value;
}

function formatLanguage(value: string | undefined | null) {
    if (!value) return "-";
    const match = LANGUAGE_OPTIONS.find((option) => option.value === value.toLowerCase());
    return match?.label || value;
}

function toDisplay(value: string | number | undefined | null) {
    if (value === undefined || value === null || value === "") return "-";
    return String(value);
}

function normalizeRoles(roles: string[] | undefined) {
    return (roles || []).map((role) => role.trim()).filter(Boolean);
}

function normalizeTeamForCompare(team: TeamProfilePayload) {
    return {
        name: (team.name || "").trim(),
        description: (team.description || "").trim().slice(0, 300),
        stage: (team.stage || "idea").toLowerCase(),
        timezone: (team.timezone || "UTC").trim(),
        language: (team.language || "ko").toLowerCase(),
        teamSize: Math.max(1, Number(team.teamSize) || 1),
        openSlots: Math.max(0, Number(team.openSlots) || 0),
        commitmentHoursPerWeek: team.commitmentHoursPerWeek || "6-10",
        workStyle: (team.workStyle || "hybrid").toLowerCase(),
        visibility: team.visibility || "Private",
        recruitingRoles: normalizeRoles(team.recruitingRoles),
    };
}

function normalizeFormForCompare(form: {
    name: string;
    description: string;
    stage: string;
    timezone: string;
    language: string;
    teamSize: string;
    openSlots: string;
    commitmentHoursPerWeek: string;
    workStyle: string;
    visibility: string;
    recruitingRoles: string[];
}) {
    return {
        name: form.name.trim(),
        description: form.description.trim().slice(0, 300),
        stage: (form.stage || "idea").toLowerCase(),
        timezone: form.timezone.trim() || "UTC",
        language: (form.language || "ko").toLowerCase(),
        teamSize: Math.max(1, Number(form.teamSize) || 1),
        openSlots: Math.max(0, Number(form.openSlots) || 0),
        commitmentHoursPerWeek: form.commitmentHoursPerWeek || "6-10",
        workStyle: (form.workStyle || "hybrid").toLowerCase(),
        visibility: form.visibility || "Private",
        recruitingRoles: normalizeRoles(form.recruitingRoles),
    };
}

export default function TeamDetailPage() {
    const params = useParams<{ teamId: string }>();
    const router = useRouter();
    const teamIdParam = Array.isArray(params?.teamId) ? params.teamId[0] : params?.teamId;
    const teamId = teamIdParam ? decodeURIComponent(teamIdParam) : "";

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [team, setTeam] = useState<TeamProfilePayload | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteError, setDeleteError] = useState("");
    const [showWorkStyleHelp, setShowWorkStyleHelp] = useState(false);
    const [leaveModalOpen, setLeaveModalOpen] = useState(false);
    const [pendingLeaveHref, setPendingLeaveHref] = useState<string | null>(null);
    const [profileMenu, setProfileMenu] = useState<ProfileMenuState | null>(null);
    const [form, setForm] = useState({
        name: "",
        description: "",
        stage: "idea",
        timezone: "UTC",
        language: "ko",
        teamSize: "1",
        openSlots: "0",
        openSlotsInput: "0",
        commitmentHoursPerWeek: "6-10",
        workStyle: "hybrid",
        visibility: "Private",
        recruitingRoles: [] as string[],
        roleInput: "",
    });

    useEffect(() => {
        async function load() {
            if (!teamId) {
                setError("Invalid team id.");
                setLoading(false);
                return;
            }

            setLoading(true);
            setError("");
            try {
                const res = await fetch(`/api/teams/${encodeURIComponent(teamId)}`);
                const payload = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(payload.error || "Failed to load team profile.");
                }
                const loadedTeam = payload as TeamProfilePayload;
                setTeam(loadedTeam);
                setForm({
                    name: loadedTeam.name || "",
                    description: loadedTeam.description || "",
                    stage: loadedTeam.stage || "idea",
                    timezone: loadedTeam.timezone || "UTC",
                    language: loadedTeam.language || "ko",
                    teamSize: String(loadedTeam.teamSize ?? 1),
                    openSlots: String(loadedTeam.openSlots ?? 0),
                    openSlotsInput: String(loadedTeam.openSlots ?? 0),
                    commitmentHoursPerWeek: loadedTeam.commitmentHoursPerWeek || "6-10",
                    workStyle: loadedTeam.workStyle || "hybrid",
                    visibility: loadedTeam.visibility || "Private",
                    recruitingRoles: loadedTeam.recruitingRoles || [],
                    roleInput: "",
                });
            } catch (e: any) {
                setError(e?.message || "Failed to load team profile.");
            } finally {
                setLoading(false);
            }
        }

        void load();
    }, [teamId]);

    const visibilityLabel = useMemo(
        () => (team?.visibility === "Public" ? "public" : "private"),
        [team?.visibility]
    );
    const canEdit = Boolean(team?.isOwner);
    const canAddRole = form.roleInput.trim().length > 0;
    const isDirty = useMemo(() => {
        if (!team) return false;
        const baseline = normalizeTeamForCompare(team);
        const editing = normalizeFormForCompare(form);
        return JSON.stringify(baseline) !== JSON.stringify(editing);
    }, [team, form]);
    const hasUnsavedChanges = canEdit && isEditing && isDirty;

    useEffect(() => {
        if (!hasUnsavedChanges) return;

        const handleDocumentClick = (event: MouseEvent) => {
            if (event.defaultPrevented || event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

            const target = event.target as HTMLElement | null;
            if (!target) return;

            const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
            if (!anchor) return;
            if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

            const href = anchor.getAttribute("href");
            if (!href || href.startsWith("#")) return;

            const nextUrl = new URL(anchor.href, window.location.href);
            const currentUrl = new URL(window.location.href);
            if (nextUrl.href === currentUrl.href) return;

            event.preventDefault();
            event.stopPropagation();
            setPendingLeaveHref(nextUrl.href);
            setLeaveModalOpen(true);
        };

        document.addEventListener("click", handleDocumentClick, true);
        return () => document.removeEventListener("click", handleDocumentClick, true);
    }, [hasUnsavedChanges]);

    useEffect(() => {
        if (!profileMenu) return;

        const closeOnOutsideClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest("[data-team-profile-menu='true']")) return;
            setProfileMenu(null);
        };
        const closeOnResize = () => setProfileMenu(null);
        const closeOnKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setProfileMenu(null);
        };

        document.addEventListener("mousedown", closeOnOutsideClick);
        window.addEventListener("resize", closeOnResize);
        window.addEventListener("keydown", closeOnKeyDown);
        return () => {
            document.removeEventListener("mousedown", closeOnOutsideClick);
            window.removeEventListener("resize", closeOnResize);
            window.removeEventListener("keydown", closeOnKeyDown);
        };
    }, [profileMenu]);

    useEffect(() => {
        if (!hasUnsavedChanges) return;

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [hasUnsavedChanges]);

    const addRole = () => {
        const value = form.roleInput.trim().replace(/\s+/g, " ");
        if (!value) return;
        if (form.recruitingRoles.some((role) => role.toLowerCase() === value.toLowerCase())) {
            setForm((prev) => ({ ...prev, roleInput: "" }));
            return;
        }
        setForm((prev) => ({
            ...prev,
            recruitingRoles: [...prev.recruitingRoles, value],
            roleInput: "",
        }));
    };

    const removeRole = (target: string) => {
        setForm((prev) => ({
            ...prev,
            recruitingRoles: prev.recruitingRoles.filter((role) => role !== target),
        }));
    };

    const saveProfile = async () => {
        if (!team || !canEdit || isSaving) return;

        setIsSaving(true);
        setSaveError("");

        const recruitingRoles = form.recruitingRoles;
        const normalizedName = form.name.trim();
        const normalizedDescription = form.description.trim().slice(0, 300);
        const normalizedStage = form.stage;
        const normalizedTimezone = form.timezone.trim();
        const normalizedLanguage = form.language;
        const normalizedTeamSize = Number(form.teamSize) || 1;
        const normalizedOpenSlots = Math.max(0, Number(form.openSlots) || 0);
        const normalizedCommitment = form.commitmentHoursPerWeek;
        const normalizedWorkStyle = form.workStyle;
        const normalizedVisibility = form.visibility;
        const currentStage = team.stage || "idea";
        const currentTimezone = team.timezone || "UTC";
        const currentLanguage = team.language || "ko";
        const currentTeamSize = typeof team.teamSize === "number" ? team.teamSize : 1;
        const currentOpenSlots = typeof team.openSlots === "number" ? team.openSlots : 0;
        const currentCommitment = team.commitmentHoursPerWeek || "6-10";
        const currentWorkStyle = team.workStyle || "hybrid";
        const currentVisibility = team.visibility || "Private";
        const currentRoles = team.recruitingRoles || [];
        const sameRoles =
            currentRoles.length === recruitingRoles.length &&
            currentRoles.every((role, index) => role === recruitingRoles[index]);
        const patchBody: Record<string, unknown> = {};

        if (normalizedName && normalizedName !== team.name) patchBody.name = normalizedName;
        if (normalizedDescription !== (team.description || "")) patchBody.description = normalizedDescription;
        if (normalizedStage !== currentStage) patchBody.stage = normalizedStage;
        if (normalizedTimezone !== currentTimezone) patchBody.timezone = normalizedTimezone;
        if (normalizedLanguage !== currentLanguage) patchBody.language = normalizedLanguage;
        if (normalizedTeamSize !== currentTeamSize) patchBody.teamSize = normalizedTeamSize;
        if (normalizedOpenSlots !== currentOpenSlots) patchBody.openSlots = normalizedOpenSlots;
        if (normalizedCommitment !== currentCommitment) patchBody.commitmentHoursPerWeek = normalizedCommitment;
        if (normalizedWorkStyle !== currentWorkStyle) patchBody.workStyle = normalizedWorkStyle;
        if (normalizedVisibility !== currentVisibility) patchBody.visibility = normalizedVisibility;
        if (!sameRoles) patchBody.recruitingRoles = recruitingRoles;

        if (Object.keys(patchBody).length === 0) {
            setIsEditing(false);
            setIsSaving(false);
            return;
        }

        try {
            const res = await fetch(`/api/teams/${encodeURIComponent(team.teamId)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patchBody),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload.error || "Failed to update team profile.");
            }

            const updated = payload.team as TeamProfilePayload;
            setTeam((prev) => ({
                ...(prev || updated),
                ...updated,
                isOwner: prev?.isOwner ?? true,
                members: prev?.members ?? updated.members,
                isMember: prev?.isMember ?? updated.isMember,
            }));
            setForm((prev) => ({
                ...prev,
                name: updated.name || prev.name,
                description: updated.description || "",
                stage: updated.stage || "idea",
                timezone: updated.timezone || "UTC",
                language: updated.language || "ko",
                teamSize: String(updated.teamSize ?? 1),
                openSlots: String(updated.openSlots ?? 0),
                openSlotsInput: String(updated.openSlots ?? 0),
                commitmentHoursPerWeek: updated.commitmentHoursPerWeek || "6-10",
                workStyle: updated.workStyle || "hybrid",
                visibility: updated.visibility || "Private",
                recruitingRoles: updated.recruitingRoles || [],
                roleInput: "",
            }));
            setIsEditing(false);
        } catch (e: any) {
            setSaveError(e?.message || "Failed to update team profile.");
        } finally {
            setIsSaving(false);
        }
    };

    const cancelLeave = () => {
        setPendingLeaveHref(null);
        setLeaveModalOpen(false);
    };

    const confirmLeave = () => {
        if (!pendingLeaveHref) {
            setLeaveModalOpen(false);
            return;
        }

        const destination = new URL(pendingLeaveHref, window.location.href);
        setPendingLeaveHref(null);
        setLeaveModalOpen(false);

        if (destination.origin === window.location.origin) {
            router.push(`${destination.pathname}${destination.search}${destination.hash}`);
            return;
        }

        window.location.href = destination.href;
    };

    const openProfileMenu = (event: React.MouseEvent, userId: string) => {
        if (!userId) return;
        event.preventDefault();
        event.stopPropagation();

        const menuWidth = 132;
        const menuHeight = 44;
        const edgeGap = 8;
        const x = Math.min(Math.max(event.clientX, edgeGap), window.innerWidth - menuWidth - edgeGap);
        const y = Math.min(Math.max(event.clientY, edgeGap), window.innerHeight - menuHeight - edgeGap);
        setProfileMenu({ x, y, userId });
    };

    const openProfileFromMenu = () => {
        if (!profileMenu) return;
        router.push(`/people/${encodeURIComponent(profileMenu.userId)}`);
        setProfileMenu(null);
    };

    const openDeleteModal = () => {
        if (!canEdit || isEditing || isDeleting) return;
        setDeleteError("");
        setDeleteModalOpen(true);
    };

    const cancelDeleteTeam = () => {
        if (isDeleting) return;
        setDeleteModalOpen(false);
    };

    const confirmDeleteTeam = async () => {
        if (!team || !canEdit || isDeleting) return;
        setIsDeleting(true);
        setDeleteError("");

        try {
            const res = await fetch(`/api/teams/${encodeURIComponent(team.teamId)}`, {
                method: "DELETE",
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload.error || "Failed to delete team.");
            }

            if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("onbure-teams-updated"));
            }
            setDeleteModalOpen(false);
            router.push("/discovery");
        } catch (e: any) {
            setDeleteError(e?.message || "Failed to delete team.");
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading) {
        return <div className="text-[var(--muted)]">Loading team profile...</div>;
    }

    if (error || !team) {
        return (
            <div className="space-y-4">
                <Link href="/discovery" className="text-sm text-[var(--muted)] hover:text-[var(--fg)] inline-flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Discovery
                </Link>
                <div className="text-rose-500 text-sm">{error || "Team not found."}</div>
            </div>
        );
    }

    return (
        <>
        <div className="max-w-4xl mx-auto space-y-6">
            <Link href="/discovery" className="text-sm text-[var(--muted)] hover:text-[var(--fg)] inline-flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Discovery
            </Link>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-2xl font-bold text-[var(--fg)] truncate">
                                {isEditing ? form.name || "-" : team.name}
                            </h1>
                            <span className="px-2 py-0.5 rounded-full bg-[var(--card-bg-hover)] border border-[var(--border)] text-[10px] uppercase tracking-wide text-[var(--muted)]">
                                {isEditing ? form.visibility.toLowerCase() : visibilityLabel}
                            </span>
                        </div>
                        <p className="text-sm text-[var(--muted)]">{isEditing ? form.description || "-" : team.description || "-"}</p>
                    </div>

                    <div className="flex items-center gap-2">
                        {canEdit && !isEditing && (
                            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                                Edit Profile
                            </Button>
                        )}
                        {canEdit && isEditing && (
                            <>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                        setIsEditing(false);
                                        setSaveError("");
                                        setForm({
                                            name: team.name || "",
                                            description: team.description || "",
                                            stage: team.stage || "idea",
                                            timezone: team.timezone || "UTC",
                                            language: team.language || "ko",
                                            teamSize: String(team.teamSize ?? 1),
                                            openSlots: String(team.openSlots ?? 0),
                                            openSlotsInput: String(team.openSlots ?? 0),
                                            commitmentHoursPerWeek: team.commitmentHoursPerWeek || "6-10",
                                            workStyle: team.workStyle || "hybrid",
                                            visibility: team.visibility || "Private",
                                            recruitingRoles: team.recruitingRoles || [],
                                            roleInput: "",
                                        });
                                    }}
                                    disabled={isSaving}
                                >
                                    Cancel
                                </Button>
                                <Button size="sm" onClick={() => void saveProfile()} disabled={isSaving}>
                                    {isSaving ? "Saving..." : "Save"}
                                </Button>
                            </>
                        )}
                        {canEdit && !isEditing && (
                            <Button size="sm" variant="destructive" onClick={openDeleteModal} disabled={isDeleting}>
                                {isDeleting ? "Deleting..." : "Delete Team"}
                            </Button>
                        )}
                    </div>
                </div>
                {deleteError && <p className="text-xs text-rose-500">{deleteError}</p>}

                {isEditing && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] p-3">
                        <div className="space-y-1 sm:col-span-2">
                            <label className="text-[10px] text-[var(--muted)] uppercase">name</label>
                            <input
                                value={form.name}
                                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value.slice(0, 60) }))}
                                className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                            />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                            <label className="text-[10px] text-[var(--muted)] uppercase">description</label>
                            <textarea
                                value={form.description}
                                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value.slice(0, 300) }))}
                                rows={4}
                                className="w-full rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                            />
                            <div className="text-[10px] text-[var(--muted)] text-right">{form.description.length}/300</div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] text-[var(--muted)] uppercase">Stage</label>
                            <select
                                value={form.stage}
                                onChange={(event) => setForm((prev) => ({ ...prev, stage: event.target.value }))}
                                className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--fg)]"
                            >
                                {STAGE_OPTIONS.map((option) => (
                                    <option key={option} value={option}>{STAGE_LABELS[option]}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-[var(--muted)] uppercase">Time Zone</label>
                            <select
                                value={form.timezone}
                                onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value }))}
                                className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--fg)]"
                            >
                                {[form.timezone, ...COMMON_TIMEZONES.filter((option) => option !== form.timezone)].map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-[var(--muted)] uppercase">Team Language</label>
                            <select
                                value={form.language}
                                onChange={(event) => setForm((prev) => ({ ...prev, language: event.target.value }))}
                                className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--fg)]"
                            >
                                {LANGUAGE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-[var(--muted)] uppercase">Visibility</label>
                            <select
                                value={form.visibility}
                                onChange={(event) => setForm((prev) => ({ ...prev, visibility: event.target.value }))}
                                className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--fg)]"
                            >
                                {VISIBILITY_OPTIONS.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-[var(--muted)] uppercase">Current Members</label>
                            <input
                                type="number"
                                min={1}
                                value={form.teamSize}
                                onChange={(event) => setForm((prev) => ({ ...prev, teamSize: event.target.value }))}
                                className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--fg)]"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-[var(--muted)] uppercase">Max People</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={form.openSlotsInput}
                                onChange={(event) =>
                                    setForm((prev) => {
                                        const digitsOnly = event.target.value.replace(/\D/g, "");
                                        if (!digitsOnly) {
                                            return { ...prev, openSlots: "0", openSlotsInput: "" };
                                        }
                                        const normalized = String(Number.parseInt(digitsOnly, 10));
                                        return { ...prev, openSlots: normalized, openSlotsInput: normalized };
                                    })
                                }
                                onBlur={() =>
                                    setForm((prev) => {
                                        if (prev.openSlotsInput === "") {
                                            return { ...prev, openSlots: "0", openSlotsInput: "0" };
                                        }
                                        return { ...prev, openSlotsInput: prev.openSlots };
                                    })
                                }
                                className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--fg)]"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-[var(--muted)] uppercase">Weekly Commitment</label>
                            <select
                                value={form.commitmentHoursPerWeek}
                                onChange={(event) => setForm((prev) => ({ ...prev, commitmentHoursPerWeek: event.target.value }))}
                                className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--fg)]"
                            >
                                {COMMITMENT_OPTIONS.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                                <label className="text-[10px] text-[var(--muted)] uppercase">Work Style</label>
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
                                value={form.workStyle}
                                onChange={(event) => setForm((prev) => ({ ...prev, workStyle: event.target.value }))}
                                className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--fg)]"
                            >
                                {WORK_STYLE_OPTIONS.map((option) => (
                                    <option key={option} value={option}>{WORK_STYLE_LABELS[option]}</option>
                                ))}
                            </select>
                            {showWorkStyleHelp && (
                                <div className="rounded-md border border-[var(--border)] bg-[var(--card-bg)] p-2 text-[11px] text-[var(--muted)] space-y-1.5">
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
                        <div className="space-y-1 sm:col-span-2">
                            <label className="text-[10px] text-[var(--muted)] uppercase">Recruiting Roles</label>
                            <div className="flex gap-2">
                                <input
                                    value={form.roleInput}
                                    onChange={(event) => setForm((prev) => ({ ...prev, roleInput: event.target.value }))}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            addRole();
                                        }
                                    }}
                                    className="flex-1 h-9 rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--fg)]"
                                    placeholder="e.g. Frontend Engineer"
                                />
                                <Button type="button" size="sm" variant="outline" onClick={addRole} disabled={!canAddRole}>
                                    Add
                                </Button>
                            </div>
                            {form.recruitingRoles.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {form.recruitingRoles.map((role) => (
                                        <span
                                            key={role}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-[var(--border)] text-xs text-[var(--fg)] bg-[var(--card-bg)]"
                                        >
                                            {role}
                                            <button
                                                type="button"
                                                className="text-[var(--muted)] hover:text-[var(--fg)]"
                                                onClick={() => removeRole(role)}
                                                aria-label={`Remove ${role}`}
                                            >
                                                x
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        {saveError && <p className="text-xs text-rose-500 sm:col-span-2">{saveError}</p>}
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-lg border border-[var(--border)] px-3 py-2">
                        <p className="text-[10px] text-[var(--muted)] uppercase">Stage</p>
                        <p className="text-[var(--fg)] mt-1">{formatStage(team.stage)}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] px-3 py-2">
                        <p className="text-[10px] text-[var(--muted)] uppercase">Time Zone</p>
                        <p className="text-[var(--fg)] mt-1">{toDisplay(team.timezone || "UTC")}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] px-3 py-2">
                        <p className="text-[10px] text-[var(--muted)] uppercase">Team Language</p>
                        <p className="text-[var(--fg)] mt-1">{formatLanguage(team.language)}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] px-3 py-2">
                        <p className="text-[10px] text-[var(--muted)] uppercase">Current Members</p>
                        <p className="text-[var(--fg)] mt-1">{toDisplay(team.teamSize)}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] px-3 py-2">
                        <p className="text-[10px] text-[var(--muted)] uppercase">Max People</p>
                        <p className="text-[var(--fg)] mt-1">{toDisplay(typeof team.openSlots === "number" ? team.openSlots : 0)}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] px-3 py-2">
                        <p className="text-[10px] text-[var(--muted)] uppercase">Weekly Commitment</p>
                        <p className="text-[var(--fg)] mt-1">{toDisplay(team.commitmentHoursPerWeek || "6-10")}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] px-3 py-2 sm:col-span-2 lg:col-span-3">
                        <div className="flex items-center gap-1.5">
                            <p className="text-[10px] text-[var(--muted)] uppercase">Work Style</p>
                            <button
                                type="button"
                                aria-label="Work style guide"
                                onClick={() => setShowWorkStyleHelp((prev) => !prev)}
                                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border)] text-[10px] font-semibold text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--fg)]"
                            >
                                !
                            </button>
                        </div>
                        <p className="text-[var(--fg)] mt-1">{formatWorkStyle(team.workStyle || "hybrid")}</p>
                        {showWorkStyleHelp && (
                            <div className="mt-2 rounded-md border border-[var(--border)] bg-[var(--input-bg)] p-2 text-[11px] text-[var(--muted)] space-y-1.5">
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
                </div>

                <div className="space-y-2">
                    <h2 className="text-sm font-semibold text-[var(--fg)]">Recruiting Roles</h2>
                    <div className="flex flex-wrap gap-2">
                        {team.recruitingRoles && team.recruitingRoles.length > 0 ? (
                            team.recruitingRoles.map((role) => (
                                <span key={role} className="text-xs px-2 py-1 rounded bg-[var(--card-bg-hover)] border border-[var(--border)] text-[var(--fg)]">
                                    {role}
                                </span>
                            ))
                        ) : (
                            <span className="text-sm text-[var(--muted)]">No recruiting roles.</span>
                        )}
                    </div>
                </div>

                {Array.isArray(team.members) && (
                    <div className="space-y-2">
                        <h2 className="text-sm font-semibold text-[var(--fg)] inline-flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Members ({team.members.length})
                        </h2>
                        <div className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] p-3 space-y-2 max-h-44 overflow-auto">
                            {team.members.length > 0 ? (
                                team.members.map((member) => (
                                    <div
                                        key={`${member.teamId}:${member.userId}`}
                                        onContextMenu={(event) => openProfileMenu(event, member.userId)}
                                        className="flex items-center justify-between text-sm rounded-md px-2 py-1.5 hover:bg-[var(--card-bg-hover)] cursor-context-menu"
                                    >
                                        <span className="text-[var(--fg)] truncate">{member.username || member.userId}</span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--muted)]">
                                            {member.role}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-[var(--muted)]">No active members.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
        {profileMenu && (
            <div
                data-team-profile-menu="true"
                className="fixed z-[70] min-w-[132px] border rounded-md shadow-md py-1"
                style={{
                    left: `${profileMenu.x}px`,
                    top: `${profileMenu.y}px`,
                    backgroundColor: "var(--card-bg)",
                    borderColor: "var(--border)",
                }}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <button
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                    onClick={openProfileFromMenu}
                >
                    프로필 보기
                </button>
            </div>
        )}
        <ConfirmModal
            open={leaveModalOpen}
            title="Unsaved Changes"
            message={LEAVE_CONFIRM_MESSAGE}
            confirmLabel="Leave"
            cancelLabel="Stay"
            confirmVariant="destructive"
            onConfirm={confirmLeave}
            onCancel={cancelLeave}
        />
        <ConfirmModal
            open={deleteModalOpen}
            title="Delete Team"
            message="This will delete the team and related data. This action cannot be undone."
            confirmLabel={isDeleting ? "Deleting..." : "Delete Team"}
            cancelLabel="Cancel"
            confirmVariant="destructive"
            onConfirm={confirmDeleteTeam}
            onCancel={cancelDeleteTeam}
        />
        </>
    );
}

