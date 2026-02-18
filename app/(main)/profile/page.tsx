"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { User as UserIcon, Save, Loader2, Pencil, X } from "lucide-react";
import { useTheme } from "@/components/providers";
import { AlertModal, ConfirmModal } from "@/components/ui/modal";

interface UserProfile {
    username: string;
    publicCode: string;
    email: string;
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
const LEAVE_CONFIRM_MESSAGE = "You have unsaved changes. Leave without saving?";

function normalizeProfileForCompare(profile: UserProfile): UserProfile {
    return {
        ...profile,
        username: profile.username.trim(),
        email: profile.email.trim(),
        country: profile.country || "",
        language: profile.language || "",
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
    const [profile, setProfile] = useState<UserProfile>({
        username: "",
        publicCode: "",
        email: "",
        country: "",
        language: "",
        skills: [],
        availabilityHours: "",
        bio: "",
        portfolioLinks: []
    });

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login");
            return;
        }
        if (status === "authenticated") {
            fetchProfile();
        }
    }, [status, router]);

    const fetchProfile = async () => {
        try {
            const res = await fetch("/api/profile");
            if (res.ok) {
                const data = await res.json();
                const loadedProfile: UserProfile = {
                    username: data.username || data.name || "",
                    publicCode: data.publicCode || "",
                    email: data.email || "",
                    country: data.country || "KR",
                    language: data.language || "ko",
                    skills: data.skills || [],
                    availabilityHours: data.availabilityHours || "40+",
                    bio: data.bio || "",
                    portfolioLinks: data.portfolioLinks || []
                };
                setProfile(loadedProfile);
                setInitialProfile(loadedProfile);
                setUsernameDraft(loadedProfile.username);
                setEmailDraft(loadedProfile.email);
                setTeamMemberships(data.teamMemberships || []);
            }
        } catch (error) {
            console.error("Failed to load profile", error);
        } finally {
            setIsLoading(false);
        }
    };

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
        setIsSaving(true);
        try {
            const payload: UserProfile = {
                ...profile,
                email: profile.email.trim(),
                skills: profile.skills.map((skill) => skill.trim()).filter(Boolean),
                portfolioLinks: profile.portfolioLinks.map((link) => link.trim()).filter(Boolean),
            };
            const res = await fetch("/api/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("Failed to save");
            setProfile(payload);
            setInitialProfile(payload);
            setNotice({
                open: true,
                title: "Profile updated",
                message: "Profile saved successfully!",
            });
        } catch {
            setNotice({
                open: true,
                title: "Save failed",
                message: "Failed to save profile.",
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

    if (isLoading) {
        return <div className="flex justify-center items-center h-full text-[var(--muted)]">Loading...</div>;
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
                                <h1 className="text-2xl font-bold text-[var(--fg)]">{profile.username || "Set username"}</h1>
                                <button
                                    type="button"
                                    onClick={startUsernameEdit}
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--card-bg-hover)] hover:text-[var(--fg)] transition-colors"
                                    title="Edit username"
                                    aria-label="Edit username"
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
                                    title="Edit email"
                                    aria-label="Edit email"
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
                    Save Changes
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-emerald-500 uppercase tracking-wider text-xs">Essential</h3>

                    <div className="space-y-2">
                        <label className="text-sm text-[var(--muted)]">Theme</label>
                        <select
                            value={theme}
                            onChange={(e) => setTheme(e.target.value === "dark" ? "dark" : "light")}
                            className={fieldClass}
                        >
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm text-[var(--muted)]">Country *</label>
                        <select
                            value={profile.country}
                            onChange={(e) => setProfile({ ...profile, country: e.target.value })}
                            className={fieldClass}
                        >
                            <option value="KR">South Korea</option>
                            <option value="US">United States</option>
                            <option value="JP">Japan</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm text-[var(--muted)]">Language (Translation Target) *</label>
                        <select
                            value={profile.language}
                            onChange={(e) => setProfile({ ...profile, language: e.target.value })}
                            className={fieldClass}
                        >
                            <option value="ko">Korean</option>
                            <option value="en">English</option>
                            <option value="ja">Japanese</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm text-[var(--muted)]">My Teams</label>
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
                                                {membership.role}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-[var(--muted)] mt-1">
                                            {membership.visibility} · {membership.status}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-[var(--muted)]">No team memberships yet.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-violet-500 uppercase tracking-wider text-xs">Recommended</h3>

                    <div className="space-y-2">
                        <label className="text-sm text-[var(--muted)]">Skills</label>
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
                                placeholder="Add one skill and press Enter"
                                className={fieldClass}
                            />
                            <button
                                type="button"
                                onClick={addSkill}
                                className="px-3 rounded-md border border-[var(--border)] bg-[var(--card-bg-hover)] text-[var(--fg)] text-sm"
                            >
                                Add
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
                                <p className="text-xs text-[var(--muted)]">No skills added yet.</p>
                            )}
                            {profile.skills.length > 4 && (
                                <button
                                    type="button"
                                    onClick={() => setSkillsExpanded((prev) => !prev)}
                                    className="mt-2 text-xs text-[var(--primary)] hover:underline"
                                >
                                    {skillsExpanded ? "Collapse" : `Show all (${profile.skills.length})`}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm text-[var(--muted)]">Availability (Hrs/Week)</label>
                        <select
                            value={profile.availabilityHours}
                            onChange={(e) => setProfile({ ...profile, availabilityHours: e.target.value })}
                            className={fieldClass}
                        >
                            <option value="1-5">1-5 hours</option>
                            <option value="6-10">6-10 hours</option>
                            <option value="11-20">11-20 hours</option>
                            <option value="21-40">21-40 hours</option>
                            <option value="40+">40+ hours</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-[var(--muted)] uppercase tracking-wider text-xs">Optional</h3>

                    <div className="space-y-2">
                        <label className="text-sm text-[var(--muted)]">Bio</label>
                        <textarea
                            value={profile.bio}
                            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                            rows={4}
                            className={fieldClass}
                            placeholder="Tell us about yourself..."
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm text-[var(--muted)]">Portfolio Links (One per line)</label>
                        <textarea
                            value={profile.portfolioLinks.join("\n")}
                            onChange={(e) => setProfile({ ...profile, portfolioLinks: e.target.value.split("\n") })}
                            rows={4}
                            className={fieldClass}
                            placeholder="https://github.com/..."
                        />
                    </div>
                </div>
            </div>
        </div>
        <AlertModal
            open={notice.open}
            title={notice.title}
            message={notice.message}
            onClose={closeNotice}
        />
        <ConfirmModal
            open={leaveModalOpen}
            title="Unsaved changes"
            message={LEAVE_CONFIRM_MESSAGE}
            confirmLabel="Leave"
            cancelLabel="Stay"
            confirmVariant="destructive"
            onConfirm={confirmLeave}
            onCancel={cancelLeave}
        />
        </>
    );
}
