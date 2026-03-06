"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/modal";
import { trackUxClick } from "@/lib/ux/client";
import { useLanguage } from "@/components/providers";
import { resolveTeamApiErrorMessage } from "@/lib/i18n/team-api-errors";

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
    descriptionTranslated?: string | null;
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
const LANGUAGE_OPTIONS = ["ko", "ja", "en", "fr", "es"] as const;
const VISIBILITY_OPTIONS = ["Public", "Private"] as const;
const COMMON_TIMEZONES = ["UTC", "Asia/Seoul", "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Tokyo"];

function formatStage(
    value: string | undefined | null,
    labels: Record<(typeof STAGE_OPTIONS)[number], string>
) {
    if (!value) return "-";
    const key = value.toLowerCase() as (typeof STAGE_OPTIONS)[number];
    return labels[key] || value;
}

function formatWorkStyle(
    value: string | undefined | null,
    labels: Record<(typeof WORK_STYLE_OPTIONS)[number], string>
) {
    if (!value) return "-";
    const key = value.toLowerCase() as (typeof WORK_STYLE_OPTIONS)[number];
    return labels[key] || value;
}

function formatLanguage(value: string | undefined | null, labels: Record<string, string>) {
    if (!value) return "-";
    return labels[value.toLowerCase()] || value;
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
    const { t } = useLanguage();
    const teamIdParam = Array.isArray(params?.teamId) ? params.teamId[0] : params?.teamId;
    const teamId = teamIdParam ? decodeURIComponent(teamIdParam) : "";

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [team, setTeam] = useState<TeamProfilePayload | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [isLeavingTeam, setIsLeavingTeam] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteError, setDeleteError] = useState("");
    const [deletePassword, setDeletePassword] = useState("");
    const [leaveTeamModalOpen, setLeaveTeamModalOpen] = useState(false);
    const [leaveTeamError, setLeaveTeamError] = useState("");
    const [leaveTeamPassword, setLeaveTeamPassword] = useState("");
    const [workStyleTooltip, setWorkStyleTooltip] = useState<{ x: number; y: number } | null>(null);
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

    const trackTeamAction = (actionKey: string, context?: Record<string, unknown>) => {
        trackUxClick(actionKey, {
            page: "team_profile",
            teamId,
            ...context,
        });
    };

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
    const languageLabels = useMemo<Record<string, string>>(
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
        async function load() {
            if (!teamId) {
                setError(t("team.error.invalidTeamId"));
                setLoading(false);
                return;
            }

            setLoading(true);
            setError("");
            try {
                const res = await fetch(`/api/teams/${encodeURIComponent(teamId)}`);
                const payload = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(resolveTeamApiErrorMessage(payload?.error, t, "team.error.loadFailed"));
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
                setError(e?.message || t("team.error.loadFailed"));
            } finally {
                setLoading(false);
            }
        }

        void load();
    }, [teamId, t]);

    const visibilityLabel = useMemo(
        () => (team?.visibility === "Public" ? t("visibility.public") : t("visibility.private")),
        [team?.visibility, t]
    );
    const canEdit = Boolean(team?.isOwner);
    const canLeaveTeam = Boolean(team?.isMember) && !Boolean(team?.isOwner);
    const canAddRole = form.roleInput.trim().length > 0;
    const descriptionForView = team?.descriptionTranslated || team?.description || "-";
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
                throw new Error(resolveTeamApiErrorMessage(payload?.error, t, "team.error.updateFailed"));
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
            setSaveError(e?.message || t("team.error.updateFailed"));
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
        setDeletePassword("");
        setDeleteModalOpen(true);
    };

    const cancelDeleteTeam = () => {
        if (isDeleting) return;
        setDeleteModalOpen(false);
        setDeletePassword("");
        setDeleteError("");
    };

    const openLeaveTeamModal = () => {
        if (!canLeaveTeam || isEditing || isLeavingTeam) return;
        setLeaveTeamError("");
        setLeaveTeamPassword("");
        setLeaveTeamModalOpen(true);
    };

    const cancelLeaveTeam = () => {
        if (isLeavingTeam) return;
        setLeaveTeamModalOpen(false);
        setLeaveTeamPassword("");
        setLeaveTeamError("");
    };

    const confirmLeaveTeam = async () => {
        if (!team || !canLeaveTeam || isLeavingTeam) return;
        if (!leaveTeamPassword) {
            setLeaveTeamError(t("team.error.passwordRequired"));
            return;
        }
        setIsLeavingTeam(true);
        setLeaveTeamError("");

        try {
            const res = await fetch(`/api/teams/${encodeURIComponent(team.teamId)}/leave`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: leaveTeamPassword }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(resolveTeamApiErrorMessage(payload?.error, t, "team.error.leaveFailed"));
            }

            if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("onbure-teams-updated"));
            }
            setLeaveTeamModalOpen(false);
            setLeaveTeamPassword("");
            router.push("/discovery");
        } catch (e: any) {
            setLeaveTeamError(e?.message || t("team.error.leaveFailed"));
        } finally {
            setIsLeavingTeam(false);
        }
    };

    const confirmDeleteTeam = async () => {
        if (!team || !canEdit || isDeleting) return;
        if (!deletePassword) {
            setDeleteError(t("team.error.passwordRequired"));
            return;
        }
        setIsDeleting(true);
        setDeleteError("");

        try {
            const res = await fetch(`/api/teams/${encodeURIComponent(team.teamId)}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: deletePassword }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(resolveTeamApiErrorMessage(payload?.error, t, "team.error.deleteFailed"));
            }

            if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("onbure-teams-updated"));
            }
            setDeleteModalOpen(false);
            setDeletePassword("");
            router.push("/discovery");
        } catch (e: any) {
            setDeleteError(e?.message || t("team.error.deleteFailed"));
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading) {
        return <div className="text-[var(--muted)]">{t("team.loadingProfile")}</div>;
    }

    if (error || !team) {
        return (
            <div className="space-y-4">
                <Link href="/discovery" className="text-sm text-[var(--muted)] hover:text-[var(--fg)] inline-flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    {t("team.backToDiscovery")}
                </Link>
                <div className="text-rose-500 text-sm">{error || t("team.notFound")}</div>
            </div>
        );
    }

    return (
        <>
        <div className="max-w-4xl mx-auto space-y-6">
            <Link href="/discovery" className="text-sm text-[var(--muted)] hover:text-[var(--fg)] inline-flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                {t("team.backToDiscovery")}
            </Link>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-2xl font-bold text-[var(--fg)] truncate">
                                {isEditing ? form.name || "-" : team.name}
                            </h1>
                            <span className="px-2 py-0.5 rounded-full bg-[var(--card-bg-hover)] border border-[var(--border)] text-[10px] uppercase tracking-wide text-[var(--muted)]">
                                {isEditing
                                    ? form.visibility === "Public"
                                        ? t("visibility.public")
                                        : t("visibility.private")
                                    : visibilityLabel}
                            </span>
                        </div>
                        <p className="text-sm text-[var(--muted)]">
                            {isEditing ? form.description || "-" : descriptionForView}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {canLeaveTeam && !isEditing && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={openLeaveTeamModal}
                                disabled={isLeavingTeam}
                                className="text-rose-500 border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/60"
                            >
                                {isLeavingTeam ? t("team.leavingTeam") : t("team.leaveTeam")}
                            </Button>
                        )}
                        {canEdit && !isEditing && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="text-[var(--fg)] hover:border-[var(--border)] hover:bg-[var(--card-bg-hover)]"
                                onClick={() => {
                                    trackTeamAction("myteam.edit_profile");
                                    setIsEditing(true);
                                }}
                            >
                                {t("team.editProfile")}
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
                                    {t("common.cancel")}
                                </Button>
                                <Button size="sm" onClick={() => void saveProfile()} disabled={isSaving}>
                                    {isSaving ? t("team.saving") : t("team.save")}
                                </Button>
                            </>
                        )}
                        {canEdit && !isEditing && (
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                    trackTeamAction("myteam.delete_team");
                                    openDeleteModal();
                                }}
                                disabled={isDeleting}
                            >
                                {isDeleting ? t("team.deletingTeam") : t("team.deleteTeam")}
                            </Button>
                        )}
                    </div>
                </div>
                {isEditing && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] p-3">
                        <div className="space-y-1 sm:col-span-2">
                            <label className="text-[10px] text-[var(--muted)] uppercase">{t("team.field.name")}</label>
                            <input
                                value={form.name}
                                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value.slice(0, 60) }))}
                                className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                            />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                            <label className="text-[10px] text-[var(--muted)] uppercase">{t("team.field.description")}</label>
                            <textarea
                                value={form.description}
                                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value.slice(0, 300) }))}
                                rows={4}
                                className="w-full rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                            />
                            <div className="text-[10px] text-[var(--muted)] text-right">{form.description.length}/300</div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] text-[var(--muted)] uppercase">{t("team.field.stage")}</label>
                            <select
                                value={form.stage}
                                onChange={(event) => setForm((prev) => ({ ...prev, stage: event.target.value }))}
                                className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--fg)]"
                            >
                                {STAGE_OPTIONS.map((option) => (
                                    <option key={option} value={option}>{stageLabels[option]}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-[var(--muted)] uppercase">{t("team.field.timeZone")}</label>
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
                            <label className="text-[10px] text-[var(--muted)] uppercase">{t("team.field.teamLanguage")}</label>
                            <select
                                value={form.language}
                                onChange={(event) => setForm((prev) => ({ ...prev, language: event.target.value }))}
                                className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--fg)]"
                            >
                                {LANGUAGE_OPTIONS.map((option) => (
                                    <option key={option} value={option}>{languageLabels[option]}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-[var(--muted)] uppercase">{t("team.field.visibility")}</label>
                            <select
                                value={form.visibility}
                                onChange={(event) => setForm((prev) => ({ ...prev, visibility: event.target.value }))}
                                className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--fg)]"
                            >
                                {VISIBILITY_OPTIONS.map((option) => (
                                    <option key={option} value={option}>
                                        {option === "Public" ? t("visibility.public") : t("visibility.private")}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-[var(--muted)] uppercase">{t("team.field.currentMembers")}</label>
                            <input
                                type="number"
                                min={1}
                                value={form.teamSize}
                                onChange={(event) => setForm((prev) => ({ ...prev, teamSize: event.target.value }))}
                                className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--fg)]"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-[var(--muted)] uppercase">{t("team.field.maxPeople")}</label>
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
                            <label className="text-[10px] text-[var(--muted)] uppercase">{t("team.field.weeklyCommitment")}</label>
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
                                <label className="text-[10px] text-[var(--muted)] uppercase">{t("team.field.workStyle")}</label>
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
                                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border)] text-[10px] font-semibold text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--fg)]"
                                >
                                    !
                                </button>
                            </span>
                            </div>
                            <select
                                value={form.workStyle}
                                onChange={(event) => setForm((prev) => ({ ...prev, workStyle: event.target.value }))}
                                className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--fg)]"
                            >
                                {WORK_STYLE_OPTIONS.map((option) => (
                                    <option key={option} value={option}>{workStyleLabels[option]}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                            <label className="text-[10px] text-[var(--muted)] uppercase">{t("team.field.recruitingRoles")}</label>
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
                                    placeholder={t("team.rolePlaceholder")}
                                />
                                <Button type="button" size="sm" variant="outline" onClick={addRole} disabled={!canAddRole}>
                                    {t("common.add")}
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
                                                aria-label={`${t("common.remove")} ${role}`}
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
                        <p className="text-[10px] text-[var(--muted)] uppercase">{t("team.field.stage")}</p>
                        <p className="text-[var(--fg)] mt-1">{formatStage(team.stage, stageLabels)}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] px-3 py-2">
                        <p className="text-[10px] text-[var(--muted)] uppercase">{t("team.field.timeZone")}</p>
                        <p className="text-[var(--fg)] mt-1">{toDisplay(team.timezone || "UTC")}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] px-3 py-2">
                        <p className="text-[10px] text-[var(--muted)] uppercase">{t("team.field.teamLanguage")}</p>
                        <p className="text-[var(--fg)] mt-1">{formatLanguage(team.language, languageLabels)}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] px-3 py-2">
                        <p className="text-[10px] text-[var(--muted)] uppercase">{t("team.field.currentMembers")}</p>
                        <p className="text-[var(--fg)] mt-1">{toDisplay(team.teamSize)}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] px-3 py-2">
                        <p className="text-[10px] text-[var(--muted)] uppercase">{t("team.field.maxPeople")}</p>
                        <p className="text-[var(--fg)] mt-1">{toDisplay(typeof team.openSlots === "number" ? team.openSlots : 0)}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] px-3 py-2">
                        <p className="text-[10px] text-[var(--muted)] uppercase">{t("team.field.weeklyCommitment")}</p>
                        <p className="text-[var(--fg)] mt-1">{toDisplay(team.commitmentHoursPerWeek || "6-10")}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] px-3 py-2 sm:col-span-2 lg:col-span-3">
                        <div className="flex items-center gap-1.5">
                            <p className="text-[10px] text-[var(--muted)] uppercase">{t("team.field.workStyle")}</p>
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
                                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border)] text-[10px] font-semibold text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--fg)]"
                                >
                                    !
                                </button>
                            </span>
                        </div>
                        <p className="text-[var(--fg)] mt-1">{formatWorkStyle(team.workStyle || "hybrid", workStyleLabels)}</p>
                    </div>
                </div>

                <div className="space-y-2">
                    <h2 className="text-sm font-semibold text-[var(--fg)]">{t("team.field.recruitingRoles")}</h2>
                    <div className="flex flex-wrap gap-2">
                        {team.recruitingRoles && team.recruitingRoles.length > 0 ? (
                            team.recruitingRoles.map((role) => (
                                <span key={role} className="text-xs px-2 py-1 rounded bg-[var(--card-bg-hover)] border border-[var(--border)] text-[var(--fg)]">
                                    {role}
                                </span>
                            ))
                        ) : (
                            <span className="text-sm text-[var(--muted)]">{t("team.noRecruitingRoles")}</span>
                        )}
                    </div>
                </div>

                {Array.isArray(team.members) && (
                    <div className="space-y-2">
                        <h2 className="text-sm font-semibold text-[var(--fg)] inline-flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            {t("team.members")} ({team.members.length})
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
                                        <div className="flex shrink-0 items-center gap-2">
                                            <span className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--muted)]">
                                                {member.role === "Owner"
                                                    ? t("team.role.owner")
                                                    : member.role === "Admin"
                                                        ? t("team.role.admin")
                                                        : t("team.role.member")}
                                            </span>
                                            <Link
                                                href={`/people/${encodeURIComponent(member.userId)}`}
                                                onClick={() => {
                                                    trackTeamAction("team.member_profile_button", {
                                                        memberUserId: member.userId,
                                                        source: "team_member_list",
                                                    });
                                                }}
                                                className="inline-flex h-6 items-center rounded border border-[var(--border)] px-2 text-[10px] text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                                            >
                                                {t("team.profileMenuViewProfile")}
                                            </Link>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-[var(--muted)]">{t("team.noActiveMembers")}</p>
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
                    {t("team.profileMenuViewProfile")}
                </button>
            </div>
        )}
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
        <ConfirmModal
            open={leaveModalOpen}
            title={t("team.unsavedTitle")}
            message={t("team.unsavedMessage")}
            confirmLabel={t("common.leave")}
            cancelLabel={t("common.stay")}
            confirmVariant="destructive"
            onConfirm={confirmLeave}
            onCancel={cancelLeave}
        />
        <ConfirmModal
            open={deleteModalOpen}
            title={t("team.deleteModalTitle")}
            message={t("team.deleteModalMessage")}
            confirmLabel={isDeleting ? t("team.deletingTeam") : t("team.deleteTeam")}
            cancelLabel={t("common.cancel")}
            confirmVariant="destructive"
            isProcessing={isDeleting}
            onConfirm={confirmDeleteTeam}
            onCancel={cancelDeleteTeam}
        >
            <div className="space-y-2">
                <label className="text-xs text-[var(--muted)] uppercase tracking-wider">{t("team.passwordRequiredLabel")}</label>
                <input
                    type="password"
                    value={deletePassword}
                    onChange={(event) => setDeletePassword(event.target.value)}
                    placeholder={t("team.passwordPlaceholder")}
                    className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--fg)]"
                />
                {deleteError ? <p className="text-xs text-rose-500">{deleteError}</p> : null}
            </div>
        </ConfirmModal>
        <ConfirmModal
            open={leaveTeamModalOpen}
            title={t("team.leaveModalTitle")}
            message={t("team.leaveModalMessage")}
            confirmLabel={isLeavingTeam ? t("team.leavingTeam") : t("team.leaveTeam")}
            cancelLabel={t("common.cancel")}
            confirmVariant="destructive"
            isProcessing={isLeavingTeam}
            onConfirm={confirmLeaveTeam}
            onCancel={cancelLeaveTeam}
        >
            <div className="space-y-2">
                <label className="text-xs text-[var(--muted)] uppercase tracking-wider">{t("team.passwordRequiredLabel")}</label>
                <input
                    type="password"
                    value={leaveTeamPassword}
                    onChange={(event) => setLeaveTeamPassword(event.target.value)}
                    placeholder={t("team.passwordPlaceholder")}
                    className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--fg)]"
                />
                {leaveTeamError ? <p className="text-xs text-rose-500">{leaveTeamError}</p> : null}
            </div>
        </ConfirmModal>
        </>
    );
}
