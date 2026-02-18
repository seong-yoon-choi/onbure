"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Globe, Languages, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertModal } from "@/components/ui/modal";

type ChatState = "NONE" | "PENDING" | "ACCEPTED";

interface PublicUserProfile {
    userId: string;
    publicCode: string;
    email: string;
    username: string;
    country: string;
    language: string;
    skills: string[];
    availabilityHours: string;
    availabilityStart: string;
    bio: string;
    portfolioLinks: string[];
    chatState: ChatState;
    canRequestChat: boolean;
    canInvite: boolean;
    isSelf: boolean;
}

interface ComposerState {
    isOpen: boolean;
    mode: "CHAT" | "INVITE";
    message: string;
    selectedTeamId: string;
    teamOptions: Array<{ teamId: string; name: string }>;
    isSubmitting: boolean;
    error: string;
}

const INITIAL_COMPOSER: ComposerState = {
    isOpen: false,
    mode: "CHAT",
    message: "",
    selectedTeamId: "",
    teamOptions: [],
    isSubmitting: false,
    error: "",
};

export default function PeopleProfilePage() {
    const params = useParams<{ userId: string }>();
    const userId = Array.isArray(params?.userId) ? params.userId[0] : params?.userId;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [profile, setProfile] = useState<PublicUserProfile | null>(null);
    const [myTeams, setMyTeams] = useState<Array<{ teamId: string; name: string }> | null>(null);
    const [composer, setComposer] = useState<ComposerState>(INITIAL_COMPOSER);
    const [notice, setNotice] = useState<{ open: boolean; title: string; message: string }>({
        open: false,
        title: "",
        message: "",
    });

    const openNotice = (title: string, message: string) => {
        setNotice({ open: true, title, message });
    };

    const normalizeShortMessage = (value: string, fallback: string) => {
        const trimmed = value.trim().replace(/\s+/g, " ");
        if (!trimmed) return fallback;
        return trimmed.slice(0, 160);
    };

    const getMyTeams = async () => {
        if (myTeams) return myTeams;
        const res = await fetch("/api/chat/teams");
        if (!res.ok) throw new Error("Failed to load your teams.");
        const data = (await res.json()) as Array<{ teamId: string; name: string }>;
        setMyTeams(data);
        return data;
    };

    const loadProfile = useCallback(async (silent = false) => {
        if (!userId) {
            setError("Invalid profile URL.");
            setLoading(false);
            return;
        }

        if (!silent) setLoading(true);
        setError("");

        try {
            const res = await fetch(`/api/users/${encodeURIComponent(userId)}`);
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(payload.error || "Failed to load profile.");
            }
            const data = (await res.json()) as Partial<PublicUserProfile>;
            setProfile({
                userId: data.userId || "",
                publicCode: data.publicCode || "",
                email: data.email || "",
                username: data.username || "",
                country: data.country || "",
                language: data.language || "",
                skills: data.skills || [],
                availabilityHours: data.availabilityHours || "",
                availabilityStart: data.availabilityStart || "",
                bio: data.bio || "",
                portfolioLinks: data.portfolioLinks || [],
                chatState: (data.chatState as ChatState) || "NONE",
                canRequestChat: Boolean(data.canRequestChat),
                canInvite: data.canInvite !== false,
                isSelf: Boolean(data.isSelf),
            });
        } catch (e: any) {
            setError(e?.message || "Failed to load profile.");
        } finally {
            if (!silent) setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        void loadProfile();
    }, [loadProfile]);

    useEffect(() => {
        if (!composer.isOpen) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setComposer((prev) => (prev.isSubmitting ? prev : { ...prev, isOpen: false, error: "" }));
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [composer.isOpen, composer.isSubmitting]);

    const closeComposer = () => {
        setComposer((prev) => (prev.isSubmitting ? prev : { ...prev, isOpen: false, error: "" }));
    };

    const openChatComposer = () => {
        if (!profile) return;
        if (!profile.canRequestChat) {
            const statusLabel = profile.chatState === "ACCEPTED" ? "already connected" : "already requested";
            openNotice("Chat unavailable", `This user is ${statusLabel}.`);
            return;
        }

        setComposer({
            isOpen: true,
            mode: "CHAT",
            message: "Let's chat!",
            selectedTeamId: "",
            teamOptions: [],
            isSubmitting: false,
            error: "",
        });
    };

    const openInviteComposer = async () => {
        if (!profile) return;
        if (!profile.canInvite) {
            openNotice("Invite unavailable", "You cannot invite yourself.");
            return;
        }

        try {
            const options = await getMyTeams();
            if (!options.length) {
                openNotice("Invite unavailable", "You need at least one team to send an invite.");
                return;
            }

            setComposer({
                isOpen: true,
                mode: "INVITE",
                message: "I'd like to invite you to my team.",
                selectedTeamId: options[0].teamId,
                teamOptions: options,
                isSubmitting: false,
                error: "",
            });
        } catch (e) {
            console.error(e);
            openNotice("Failed to load teams", "Please try again in a moment.");
        }
    };

    const submitComposer = async () => {
        if (!profile || !composer.isOpen || composer.isSubmitting) return;

        const fallback = composer.mode === "CHAT" ? "Let's chat!" : "I'd like to invite you to my team.";
        const message = normalizeShortMessage(composer.message, fallback);
        if (composer.mode === "INVITE" && !composer.selectedTeamId) {
            setComposer((prev) => ({ ...prev, error: "Please select a team." }));
            return;
        }

        setComposer((prev) => ({ ...prev, isSubmitting: true, error: "" }));

        try {
            const body =
                composer.mode === "CHAT"
                    ? { type: "CHAT", toId: profile.userId, message }
                    : {
                        type: "INVITE",
                        toId: profile.userId,
                        teamId: composer.selectedTeamId,
                        message,
                    };

            const res = await fetch("/api/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));

            if (res.ok) {
                if (composer.mode === "CHAT") {
                    setProfile((prev) =>
                        prev
                            ? {
                                ...prev,
                                canRequestChat: false,
                                chatState: "PENDING",
                            }
                            : prev
                    );
                }
                setComposer((prev) => ({ ...prev, isOpen: false, isSubmitting: false, error: "" }));
                return;
            }

            if (res.status === 409) {
                if (composer.mode === "CHAT") {
                    await loadProfile(true);
                    openNotice("Already requested", data.error || "A chat request already exists.");
                    setComposer((prev) => ({ ...prev, isOpen: false, isSubmitting: false, error: "" }));
                    return;
                }
                setComposer((prev) => ({
                    ...prev,
                    isSubmitting: false,
                    error: data.error || "An active request already exists.",
                }));
                return;
            }

            setComposer((prev) => ({
                ...prev,
                isSubmitting: false,
                error: data.error || "Failed to send request.",
            }));
        } catch (e) {
            console.error(e);
            setComposer((prev) => ({ ...prev, isSubmitting: false, error: "Failed to send request." }));
        }
    };

    if (loading) {
        return <div className="text-[var(--muted)]">Loading profile...</div>;
    }

    if (error || !profile) {
        return (
            <div className="space-y-4">
                <Link href="/discovery" className="text-sm text-[var(--muted)] hover:text-[var(--fg)] inline-flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Discovery
                </Link>
                <div className="text-red-500 text-sm">{error || "Profile not found."}</div>
            </div>
        );
    }

    return (
        <>
        <div className="max-w-3xl mx-auto space-y-6">
            <Link href="/discovery" className="text-sm text-[var(--muted)] hover:text-[var(--fg)] inline-flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Discovery
            </Link>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="h-16 w-16 rounded-full bg-[var(--card-bg-hover)] border border-[var(--border)] flex items-center justify-center">
                            <UserRound className="w-8 h-8 text-[var(--muted)]" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-2xl font-bold text-[var(--fg)] truncate">{profile.username}</h1>
                            <p className="text-sm text-[var(--muted)]">{profile.email || "-"}</p>
                            <p className="text-xs text-[var(--muted)]">{profile.publicCode || "-"}</p>
                        </div>
                    </div>

                    {!profile.isSelf && (
                        <div className="flex items-center gap-2">
                            {profile.canRequestChat ? (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs px-3 text-[var(--fg)] hover:border-[var(--border)] hover:bg-[var(--card-bg-hover)]"
                                    onClick={openChatComposer}
                                >
                                    Chat
                                </Button>
                            ) : (
                                <span className="h-8 px-3 inline-flex items-center rounded border border-[var(--border)] text-[10px] font-medium text-[var(--muted)]">
                                    {profile.chatState === "ACCEPTED" ? "Connected" : "Requested"}
                                </span>
                            )}
                            {profile.canInvite && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs px-3 text-[var(--fg)] hover:border-[var(--border)] hover:bg-[var(--card-bg-hover)]"
                                    onClick={() => void openInviteComposer()}
                                >
                                    Invite
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border border-[var(--border)] px-3 py-2 flex items-center gap-2 text-[var(--fg)]">
                        <Globe className="w-4 h-4 text-[var(--muted)]" />
                        <span>{profile.country || "-"}</span>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] px-3 py-2 flex items-center gap-2 text-[var(--fg)]">
                        <Languages className="w-4 h-4 text-[var(--muted)]" />
                        <span>{profile.language || "-"}</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <h2 className="text-sm font-semibold text-[var(--fg)]">Bio</h2>
                    <p className="text-sm text-[var(--muted)] whitespace-pre-wrap">
                        {profile.bio || "No bio yet."}
                    </p>
                </div>

                <div className="space-y-2">
                    <h2 className="text-sm font-semibold text-[var(--fg)]">Skills</h2>
                    <div className="flex flex-wrap gap-2">
                        {profile.skills.length > 0 ? (
                            profile.skills.map((skill) => (
                                <span key={skill} className="text-xs px-2 py-1 rounded bg-[var(--card-bg-hover)] border border-[var(--border)] text-[var(--fg)]">
                                    {skill}
                                </span>
                            ))
                        ) : (
                            <span className="text-sm text-[var(--muted)]">No skills yet.</span>
                        )}
                    </div>
                </div>

                <div className="text-sm text-[var(--muted)]">
                    {profile.availabilityHours || "-"} / week
                </div>
            </div>
        </div>

        {composer.isOpen && (
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm px-4"
                onMouseDown={(event) => {
                    if (event.target === event.currentTarget) {
                        closeComposer();
                    }
                }}
            >
                <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] shadow-2xl">
                    <div className="px-5 py-4 border-b border-[var(--border)]">
                        <h3 className="text-base font-semibold text-[var(--fg)]">
                            {composer.mode === "CHAT" ? "Send Chat Request" : "Send Team Invite"}
                        </h3>
                        <p className="text-xs text-[var(--muted)] mt-1 truncate">
                            To: {profile.username}
                        </p>
                    </div>

                    <div className="px-5 py-4 space-y-3">
                        {composer.mode === "INVITE" && (
                            <div className="space-y-1">
                                <label className="text-xs text-[var(--muted)]">Team</label>
                                <select
                                    value={composer.selectedTeamId}
                                    onChange={(event) =>
                                        setComposer((prev) => ({ ...prev, selectedTeamId: event.target.value }))
                                    }
                                    className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--fg)] focus:outline-none"
                                >
                                    {composer.teamOptions.map((team) => (
                                        <option key={team.teamId} value={team.teamId}>
                                            {team.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-xs text-[var(--muted)]">Message</label>
                            <textarea
                                value={composer.message}
                                onChange={(event) =>
                                    setComposer((prev) => ({ ...prev, message: event.target.value.slice(0, 160) }))
                                }
                                rows={4}
                                className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                                placeholder={composer.mode === "CHAT" ? "Write a short chat request..." : "Write a short invite message..."}
                            />
                            <div className="text-[10px] text-[var(--muted)] text-right">
                                {composer.message.length}/160
                            </div>
                        </div>

                        {composer.error && (
                            <p className="text-xs text-rose-500">{composer.error}</p>
                        )}
                    </div>

                    <div className="px-5 py-4 border-t border-[var(--border)] flex items-center justify-end gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={closeComposer}
                            disabled={composer.isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => void submitComposer()}
                            disabled={composer.isSubmitting}
                        >
                            {composer.isSubmitting ? "Sending..." : "Send"}
                        </Button>
                    </div>
                </div>
            </div>
        )}

        <AlertModal
            open={notice.open}
            title={notice.title}
            message={notice.message}
            onClose={() => setNotice((prev) => ({ ...prev, open: false }))}
        />
        </>
    );
}
