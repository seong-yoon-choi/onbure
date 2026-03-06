"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { User as UserIcon, Save, Loader2, Pencil, X } from "lucide-react";
import { useLanguage, useTheme } from "@/components/providers";
import { AlertModal, ConfirmModal } from "@/components/ui/modal";
import { trackUxClick } from "@/lib/ux/client";
import { ALL_SIGNUP_COUNTRIES } from "@/lib/signup-consent";
import { normalizeLanguage } from "@/lib/i18n";
import { APP_LANGUAGES } from "@/lib/i18n/messages";

interface UserProfile {
    username: string;
    publicCode: string;
    email: string;
    gender: "male" | "female" | "other" | "";
    age: string;
    country: string;
    language: string;
    skills: string[];
    availabilityHours: string;
    bio: string;
    portfolioLinks: string[];
}

interface TeamMembershipSummary {
    teamId: string;
    teamName: string;
    role: "Owner" | "Admin" | "Member";
    status: "Active" | "Inactive";
    joinedAt: string;
    visibility: "Public" | "Private";
}

const fieldClass =
    "w-full bg-[var(--input-bg)] border border-[var(--border)] rounded-md px-3 py-2 text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]";

function normalizeProfileForCompare(profile: UserProfile): UserProfile {
    return {
        ...profile,
        username: profile.username.trim(),
        email: profile.email.trim(),
        gender: profile.gender || "",
        age: String(profile.age || "").trim(),
        country: profile.country || "",
        language: normalizeLanguage(profile.language || ""),
        skills: profile.skills.map((skill) => skill.trim()).filter(Boolean),
        availabilityHours: profile.availabilityHours || "",
        bio: profile.bio.trim(),
        portfolioLinks: profile.portfolioLinks.map((link) => link.trim()).filter(Boolean),
    };
}

export default function ProfilePage() {
    const { status } = useSession();
    const router = useRouter();
    const { theme, setTheme } = useTheme();
    const { setLanguage, t } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUsernameEditing, setIsUsernameEditing] = useState(false);
    const [usernameDraft, setUsernameDraft] = useState("");
    const [isEmailEditing, setIsEmailEditing] = useState(false);
    const [emailDraft, setEmailDraft] = useState("");
    const [skillInput, setSkillInput] = useState("");
    const [skillsExpanded, setSkillsExpanded] = useState(false);
    const [initialProfile, setInitialProfile] = useState<UserProfile | null>(null);
    const [teamMemberships, setTeamMemberships] = useState<TeamMembershipSummary[]>([]);
    const [notice, setNotice] = useState<{ open: boolean; title: string; message: string }>({
        open: false,
        title: "",
        message: "",
    });
    const [leaveModalOpen, setLeaveModalOpen] = useState(false);
    const [pendingLeaveHref, setPendingLeaveHref] = useState<string | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteReason, setDeleteReason] = useState("");
    const [deletePassword, setDeletePassword] = useState("");
    const [deleteError, setDeleteError] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [profile, setProfile] = useState<UserProfile>({
        username: "",
        publicCode: "",
        email: "",
        gender: "",
        age: "",
        country: "",
        language: "",
        skills: [],
        availabilityHours: "",
        bio: "",
        portfolioLinks: [],
    });

    const trackProfileAction = (actionKey: string, context?: Record<string, unknown>) => {
        trackUxClick(actionKey, {
            page: "my_profile",
            ...context,
        });
    };

    const fetchProfile = useCallback(async () => {
        try {
            const res = await fetch("/api/profile");
            if (res.ok) {
                const data = await res.json();
                const normalizedLanguage = normalizeLanguage(data.language || "ko");
                const loadedProfile: UserProfile = {
                    username: data.username || data.name || "",
                    publicCode: data.publicCode || "",
                    email: data.email || "",
                    gender:
                        data.gender === "male" || data.gender === "female" || data.gender === "other"
                            ? data.gender
                            : "",
                    age: Number.isFinite(data.age) ? String(data.age) : "",
                    country: data.country || "KR",
                    language: normalizedLanguage,
                    skills: data.skills || [],
                    availabilityHours: data.availabilityHours || "40+",
                    bio: data.bio || "",
                    portfolioLinks: data.portfolioLinks || [],
                };
                setProfile(loadedProfile);
                setInitialProfile(loadedProfile);
                setUsernameDraft(loadedProfile.username);
                setEmailDraft(loadedProfile.email);
                setTeamMemberships(data.teamMemberships || []);
                setLanguage(normalizedLanguage);
            }
        } catch (error) {
            console.error("Failed to load profile", error);
        } finally {
            setIsLoading(false);
        }
    }, [setLanguage]);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login");
            return;
        }
        if (status === "authenticated") {
            void fetchProfile();
        }
    }, [status, router, fetchProfile]);

    const isDirty = useMemo(() => {
        if (!initialProfile) return false;
        const left = normalizeProfileForCompare(profile);
        const right = normalizeProfileForCompare(initialProfile);
        return JSON.stringify(left) !== JSON.stringify(right);
    }, [profile, initialProfile]);

    useEffect(() => {
        if (!isDirty) return;

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
    }, [isDirty]);

    const handleSave = async () => {
        trackProfileAction("profile.save_change");
        setIsSaving(true);
        try {
            const nextProfile: UserProfile = {
                ...profile,
                email: profile.email.trim(),
                skills: profile.skills.map((skill) => skill.trim()).filter(Boolean),
                portfolioLinks: profile.portfolioLinks.map((link) => link.trim()).filter(Boolean),
            };
            const parsedAge = Number.parseInt(String(nextProfile.age || "").trim(), 10);
            const payload = {
                ...nextProfile,
                gender: nextProfile.gender || null,
                age: Number.isFinite(parsedAge) ? parsedAge : null,
            };
            const res = await fetch("/api/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("Failed to save");
            setProfile(nextProfile);
            setInitialProfile(nextProfile);
            setNotice({
                open: true,
                title: t("profile.noticeUpdatedTitle"),
                message: t("profile.noticeUpdatedMessage"),
            });
        } catch {
            setNotice({
                open: true,
                title: t("profile.noticeSaveFailedTitle"),
                message: t("profile.noticeSaveFailedMessage"),
            });
        } finally {
            setIsSaving(false);
        }
    };

    const startUsernameEdit = () => {
        setUsernameDraft(profile.username || "");
        setIsUsernameEditing(true);
    };

    const commitUsernameEdit = () => {
        const trimmed = usernameDraft.trim();
        if (trimmed && trimmed !== profile.username) {
            trackProfileAction("profile.change_name");
        }
        setProfile((prev) => ({ ...prev, username: trimmed || prev.username }));
        setIsUsernameEditing(false);
    };

    const cancelUsernameEdit = () => {
        setUsernameDraft(profile.username || "");
        setIsUsernameEditing(false);
    };

    const startEmailEdit = () => {
        setEmailDraft(profile.email || "");
        setIsEmailEditing(true);
    };

    const commitEmailEdit = () => {
        const trimmed = emailDraft.trim();
        if (!trimmed) {
            setEmailDraft(profile.email || "");
            setIsEmailEditing(false);
            return;
        }
        if (trimmed !== profile.email) {
            trackProfileAction("profile.change_email");
        }
        setProfile((prev) => ({ ...prev, email: trimmed }));
        setIsEmailEditing(false);
    };

    const cancelEmailEdit = () => {
        setEmailDraft(profile.email || "");
        setIsEmailEditing(false);
    };

    const addSkill = () => {
        const value = skillInput.trim().replace(/\s+/g, " ");
        if (!value) return;
        setProfile((prev) => {
            if (prev.skills.some((skill) => skill.toLowerCase() === value.toLowerCase())) {
                return prev;
            }
            return { ...prev, skills: [...prev.skills, value] };
        });
        setSkillInput("");
    };

    const removeSkill = (skillToRemove: string) => {
        setProfile((prev) => ({
            ...prev,
            skills: prev.skills.filter((skill) => skill !== skillToRemove),
        }));
    };

    const shownSkills = skillsExpanded ? profile.skills : profile.skills.slice(0, 4);

    const closeNotice = () => {
        setNotice((prev) => ({ ...prev, open: false }));
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

    const openDeleteModal = () => {
        setDeleteReason("");
        setDeletePassword("");
        setDeleteError("");
        setDeleteModalOpen(true);
    };

    const closeDeleteModal = () => {
        if (isDeleting) return;
        setDeleteModalOpen(false);
        setDeleteError("");
        setDeletePassword("");
    };

    const confirmDeleteAccount = async () => {
        if (isDeleting) return;
        if (!deletePassword) {
            setDeleteError(t("profile.passwordRequired"));
            return;
        }
        trackProfileAction("profile.delete_account");
        setIsDeleting(true);
        setDeleteError("");

        try {
            const res = await fetch("/api/profile", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    reason: deleteReason.trim(),
                    password: deletePassword,
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                const apiError = typeof payload?.error === "string" ? String(payload.error).trim() : "";
                if (!apiError || apiError === "Failed to delete account." || apiError === "Unauthorized") {
                    throw new Error(t("profile.deleteFailed"));
                }
                throw new Error(apiError);
            }

            setDeleteModalOpen(false);
            await signOut({ callbackUrl: "/register" });
        } catch (error: any) {
            setDeleteError(error?.message || t("profile.deleteFailed"));
        } finally {
            setIsDeleting(false);
        }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-full text-[var(--muted)]">{t("common.loading")}</div>;
    }

    return (
        <>
        <div className="max-w-4xl mx-auto p-8 space-y-8">
            <header className="flex items-center justify-between border-b border-[var(--border)] pb-6">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-[var(--primary)]/15 flex items-center justify-center text-[var(--primary)]">
                        <UserIcon className="w-8 h-8" />
                    </div>
                    <div className="flex flex-col items-start gap-1">
                        {isUsernameEditing ? (
                            <input
                                type="text"
                                value={usernameDraft}
                                onChange={(e) => setUsernameDraft(e.target.value)}
                                onBlur={commitUsernameEdit}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        commitUsernameEdit();
                                    } else if (e.key === "Escape") {
                                        e.preventDefault();
                                        cancelUsernameEdit();
                                    }
                                }}
                                autoFocus
                                className="block text-2xl font-bold text-[var(--fg)] bg-transparent border-b border-[var(--ring)] focus:outline-none"
                            />
                        ) : (
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold text-[var(--fg)]">{profile.username || t("profile.setUsername")}</h1>
                                <button
                                    type="button"
                                    onClick={startUsernameEdit}
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--card-bg-hover)] hover:text-[var(--fg)] transition-colors"
                                    title={t("profile.editUsername")}
                                    aria-label={t("profile.editUsername")}
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        )}
                        {isEmailEditing ? (
                            <input
                                type="email"
                                value={emailDraft}
                                onChange={(e) => setEmailDraft(e.target.value)}
                                onBlur={commitEmailEdit}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        commitEmailEdit();
                                    } else if (e.key === "Escape") {
                                        e.preventDefault();
                                        cancelEmailEdit();
                                    }
                                }}
                                autoFocus
                                className="block text-[var(--muted)] bg-transparent border-b border-[var(--ring)] focus:outline-none"
                            />
                        ) : (
                            <div className="flex items-center gap-2">
                                <p className="text-[var(--muted)]">{profile.email || "-"}</p>
                                <button
                                    type="button"
                                    onClick={startEmailEdit}
                                    className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--card-bg-hover)] hover:text-[var(--fg)] transition-colors"
                                    title={t("profile.editEmail")}
                                    aria-label={t("profile.editEmail")}
                                >
                                    <Pencil className="h-3 w-3" />
                                </button>
                            </div>
                        )}
                        <p className="text-xs text-[var(--muted)]">{profile.publicCode || "-"}</p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-2 bg-[var(--primary)] hover:brightness-95 text-[var(--primary-foreground)] rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {t("common.saveChanges")}
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-emerald-500 uppercase tracking-wider text-xs">{t("profile.sectionEssential")}</h3>

                    <div className="space-y-2">
                        <label className="text-sm text-[var(--muted)]">{t("profile.theme")}</label>
                        <select
                            value={theme}
                            onChange={(e) => setTheme(e.target.value === "dark" ? "dark" : "light")}
                            className={fieldClass}
                        >
                            <option value="light">{t("profile.themeLight")}</option>
                            <option value="dark">{t("profile.themeDark")}</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm text-[var(--muted)]">{t("profile.gender")}</label>
                        <select
                            value={profile.gender}
                            onChange={(e) =>
                                setProfile({
                                    ...profile,
                                    gender: (e.target.value as "male" | "female" | "other" | "") || "",
                                })
                            }
                            className={fieldClass}
                        >
                            <option value="">{t("profile.genderSelect")}</option>
                            <option value="male">{t("profile.genderMale")}</option>
                            <option value="female">{t("profile.genderFemale")}</option>
                            <option value="other">{t("profile.genderOther")}</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm text-[var(--muted)]">{t("profile.age")}</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={3}
                            value={profile.age}
                            onChange={(e) => {
                                const raw = e.target.value;
                                const normalized = raw.replace(/[^\d]/g, "").replace(/^0+(\d)/, "$1");
                                setProfile({
                                    ...profile,
                                    age: normalized,
                                });
                            }}
                            className={fieldClass}
                            placeholder={t("profile.agePlaceholder")}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm text-[var(--muted)]">{t("profile.country")}</label>
                        <select
                            value={profile.country}
                            onChange={(e) => setProfile({ ...profile, country: e.target.value })}
                            className={fieldClass}
                        >
                            {ALL_SIGNUP_COUNTRIES.map((item) => (
                                <option key={item.code} value={item.code}>
                                    {item.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm text-[var(--muted)]">{t("profile.languageTarget")}</label>
                        <select
                            value={profile.language}
                            onChange={(e) => {
                                const nextLanguage = normalizeLanguage(e.target.value);
                                setProfile({ ...profile, language: nextLanguage });
                                setLanguage(nextLanguage);
                            }}
                            className={fieldClass}
                        >
                            {APP_LANGUAGES.map((code) => (
                                <option key={code} value={code}>
                                    {code === "ko"
                                        ? t("language.korean")
                                        : code === "ja"
                                            ? t("language.japanese")
                                            : code === "fr"
                                                ? t("language.french")
                                                : code === "es"
                                                    ? t("language.spanish")
                                                    : t("language.english")}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm text-[var(--muted)]">{t("profile.myTeams")}</label>
                        <div className="rounded-md border border-[var(--border)] bg-[var(--input-bg)] p-2 space-y-2 max-h-44 overflow-auto">
                            {teamMemberships.length > 0 ? (
                                teamMemberships.map((membership) => (
                                    <div
                                        key={`${membership.teamId}:${membership.role}`}
                                        className="rounded border border-[var(--border)] bg-[var(--card-bg)] px-2 py-1.5"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm font-medium text-[var(--fg)] truncate">{membership.teamName}</p>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--muted)]">
                                                {membership.role === "Owner"
                                                    ? t("team.role.owner")
                                                    : membership.role === "Admin"
                                                        ? t("team.role.admin")
                                                        : membership.role === "Member"
                                                            ? t("team.role.member")
                                                            : membership.role}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-[var(--muted)] mt-1">
                                            {t("profile.teamMembershipLine", {
                                                visibility:
                                                    membership.visibility === "Public"
                                                        ? t("visibility.public")
                                                        : membership.visibility === "Private"
                                                            ? t("visibility.private")
                                                            : membership.visibility,
                                                status:
                                                    membership.status === "Active"
                                                        ? t("status.active")
                                                        : membership.status === "Inactive"
                                                            ? t("status.inactive")
                                                            : membership.status,
                                            })}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-[var(--muted)]">{t("profile.noTeamMemberships")}</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-violet-500 uppercase tracking-wider text-xs">{t("profile.sectionRecommended")}</h3>

                    <div className="space-y-2">
                        <label className="text-sm text-[var(--muted)]">{t("profile.skills")}</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={skillInput}
                                onChange={(e) => setSkillInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        addSkill();
                                    }
                                }}
                                placeholder={t("profile.skillsPlaceholder")}
                                className={fieldClass}
                            />
                            <button
                                type="button"
                                onClick={addSkill}
                                className="shrink-0 whitespace-nowrap px-2.5 rounded-md border border-[var(--border)] bg-[var(--card-bg-hover)] text-[var(--fg)] text-xs leading-none"
                            >
                                {t("common.add")}
                            </button>
                        </div>
                        <div className="rounded-md border border-[var(--border)] bg-[var(--input-bg)] p-2 min-h-12">
                            {shownSkills.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {shownSkills.map((skill) => (
                                        <span key={skill} className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-[var(--border)] text-xs text-[var(--fg)] bg-[var(--card-bg)]">
                                            {skill}
                                            <button
                                                type="button"
                                                aria-label={`Remove ${skill}`}
                                                onClick={() => removeSkill(skill)}
                                                className="text-[var(--muted)] hover:text-[var(--fg)]"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-[var(--muted)]">{t("profile.noSkills")}</p>
                            )}
                            {profile.skills.length > 4 && (
                                <button
                                    type="button"
                                    onClick={() => setSkillsExpanded((prev) => !prev)}
                                    className="mt-2 text-xs text-[var(--primary)] hover:underline"
                                >
                                    {skillsExpanded
                                        ? t("common.collapse")
                                        : t("profile.showAll", { count: profile.skills.length })}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm text-[var(--muted)]">{t("profile.availability")}</label>
                        <select
                            value={profile.availabilityHours}
                            onChange={(e) => setProfile({ ...profile, availabilityHours: e.target.value })}
                            className={fieldClass}
                        >
                            <option value="1-5">{t("profile.hours.1-5")}</option>
                            <option value="6-10">{t("profile.hours.6-10")}</option>
                            <option value="11-20">{t("profile.hours.11-20")}</option>
                            <option value="21-40">{t("profile.hours.21-40")}</option>
                            <option value="40+">{t("profile.hours.40+")}</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-[var(--muted)] uppercase tracking-wider text-xs">{t("profile.sectionOptional")}</h3>

                    <div className="space-y-2">
                        <label className="text-sm text-[var(--muted)]">{t("profile.bio")}</label>
                        <textarea
                            value={profile.bio}
                            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                            rows={4}
                            className={fieldClass}
                            placeholder={t("profile.bioPlaceholder")}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm text-[var(--muted)]">{t("profile.portfolioLinks")}</label>
                        <textarea
                            value={profile.portfolioLinks.join("\n")}
                            onChange={(e) => setProfile({ ...profile, portfolioLinks: e.target.value.split("\n") })}
                            rows={4}
                            className={fieldClass}
                            placeholder={t("profile.portfolioPlaceholder")}
                        />
                    </div>
                </div>
            </div>

            <section className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-5">
                <h3 className="text-sm font-semibold text-rose-500 uppercase tracking-wide">{t("profile.dangerZone")}</h3>
                <p className="mt-2 text-sm text-[var(--muted)]">
                    {t("profile.deleteDescription")}
                </p>
                <button
                    type="button"
                    onClick={openDeleteModal}
                    className="mt-4 inline-flex items-center rounded-md border border-rose-500/40 px-3 py-2 text-sm font-medium text-rose-500 hover:bg-rose-500/10 transition-colors"
                >
                    {t("profile.deleteAccount")}
                </button>
            </section>
        </div>
        <AlertModal
            open={notice.open}
            title={notice.title}
            message={notice.message}
            onClose={closeNotice}
        />
        <ConfirmModal
            open={leaveModalOpen}
            title={t("profile.unsavedTitle")}
            message={t("profile.unsavedMessage")}
            confirmLabel={t("common.leave")}
            cancelLabel={t("common.stay")}
            confirmVariant="destructive"
            onConfirm={confirmLeave}
            onCancel={cancelLeave}
        />
        <ConfirmModal
            open={deleteModalOpen}
            title={t("profile.deleteModalTitle")}
            message={t("profile.deleteModalMessage")}
            confirmLabel={isDeleting ? t("common.deleting") : t("common.delete")}
            cancelLabel={t("common.cancel")}
            confirmVariant="destructive"
            isProcessing={isDeleting}
            onConfirm={() => {
                void confirmDeleteAccount();
            }}
            onCancel={closeDeleteModal}
        >
            <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider ml-1">
                    {t("profile.deleteReason")}
                </label>
                <textarea
                    value={deleteReason}
                    onChange={(event) => setDeleteReason(event.target.value)}
                    rows={3}
                    placeholder={t("profile.deleteReasonPlaceholder")}
                    className={fieldClass}
                />
                <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider ml-1">
                    {t("profile.deletePassword")}
                </label>
                <input
                    type="password"
                    value={deletePassword}
                    onChange={(event) => setDeletePassword(event.target.value)}
                    placeholder={t("profile.deletePasswordPlaceholder")}
                    className={fieldClass}
                />
                {deleteError ? (
                    <p className="text-xs text-rose-500">{deleteError}</p>
                ) : null}
            </div>
        </ConfirmModal>
        </>
    );
}


