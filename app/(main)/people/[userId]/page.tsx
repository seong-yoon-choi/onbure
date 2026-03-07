"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Globe, Languages, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertModal } from "@/components/ui/modal";
import { trackUxClick } from "@/lib/ux/client";
import { useLanguage } from "@/components/providers";

type ChatState = "NONE" | "PENDING" | "ACCEPTED";
type FriendState = "NONE" | "PENDING" | "ACCEPTED";

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
    friendState: FriendState;
    canRequestChat: boolean;
    canRequestFriend: boolean;
    canInvite: boolean;
    isSelf: boolean;
}

interface ComposerState {
    isOpen: boolean;
    mode: "CHAT" | "FRIEND" | "INVITE";
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
    const { t } = useLanguage();
    const params = useParams<{ userId: string }>();
    const router = useRouter();
    const { status: sessionStatus } = useSession();
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
    const [unfriendContext, setUnfriendContext] = useState<{
        isOpen: boolean;
        isSubmitting: boolean;
    }>({
        isOpen: false,
        isSubmitting: false,
    });

    const trackProfileAction = (actionKey: string, context?: Record<string, unknown>) => {
        trackUxClick(actionKey, {
            page: "people_profile",
            targetUserId: userId,
            ...context,
        });
    };

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
        if (!res.ok) throw new Error(t("people.loadTeamsFailedTitle"));
        const data = (await res.json()) as Array<{ teamId: string; name: string }>;
        setMyTeams(data);
        return data;
    };

    const loadProfile = useCallback(async (silent = false) => {
        if (!userId) {
            setError(t("people.invalidProfileUrl"));
            setLoading(false);
            return;
        }

        if (!silent) setLoading(true);
        setError("");

        try {
            const res = await fetch(`/api/users/${encodeURIComponent(userId)}`);
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(payload.error || t("people.loadFailed"));
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
                friendState: (data.friendState as FriendState) || "NONE",
                canRequestChat: Boolean(data.canRequestChat),
                canRequestFriend: Boolean(data.canRequestFriend),
                canInvite: data.canInvite !== false,
                isSelf: Boolean(data.isSelf),
            });
        } catch (e: any) {
            setError(e?.message || t("people.loadFailed"));
        } finally {
            if (!silent) setLoading(false);
        }
    }, [userId, t]);

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
        if (sessionStatus === "unauthenticated") {
            router.push("/login");
            return;
        }
        if (!profile) return;
        if (profile.friendState === "ACCEPTED" || profile.chatState === "ACCEPTED") {
            if (typeof window !== "undefined") {
                window.dispatchEvent(
                    new CustomEvent("onbure-open-chat-dm", {
                        detail: { userId: profile.userId, username: profile.username },
                    })
                );
            }
            return;
        }
        if (!profile.canRequestChat) {
            openNotice(t("people.chatUnavailableTitle"), t("people.chatUnavailableMessage"));
            return;
        }

        setComposer({
            isOpen: true,
            mode: "CHAT",
            message: t("people.chatDefaultMessage"),
            selectedTeamId: "",
            teamOptions: [],
            isSubmitting: false,
            error: "",
        });
    };

    const openFriendComposer = () => {
        if (sessionStatus === "unauthenticated") {
            router.push("/login");
            return;
        }
        if (!profile) return;
        if (!profile.canRequestFriend) {
            const statusLabel =
                profile.friendState === "ACCEPTED"
                    ? t("people.friendUnavailableAccepted")
                    : t("people.friendUnavailableRequested");
            openNotice(t("people.friendUnavailableTitle"), t("people.friendUnavailableMessage", { status: statusLabel }));
            return;
        }
        setComposer({
            isOpen: true,
            mode: "FRIEND",
            message: t("people.friendDefaultMessage"),
            selectedTeamId: "",
            teamOptions: [],
            isSubmitting: false,
            error: "",
        });
    };

    const openInviteComposer = async () => {
        if (sessionStatus === "unauthenticated") {
            router.push("/login");
            return;
        }
        if (!profile) return;
        if (!profile.canInvite) {
            openNotice(t("people.inviteUnavailableTitle"), t("people.inviteUnavailableSelf"));
            return;
        }

        try {
            const options = await getMyTeams();
            if (!options.length) {
                openNotice(t("people.inviteUnavailableTitle"), t("people.inviteNeedsTeam"));
                return;
            }

            setComposer({
                isOpen: true,
                mode: "INVITE",
                message: t("people.inviteDefaultMessage"),
                selectedTeamId: options[0].teamId,
                teamOptions: options,
                isSubmitting: false,
                error: "",
            });
        } catch (e) {
            console.error(e);
            openNotice(t("people.loadTeamsFailedTitle"), t("people.loadTeamsFailedMessage"));
        }
    };

    const submitComposer = async () => {
        if (!profile || !composer.isOpen || composer.isSubmitting) return;

        const fallback = composer.mode === "CHAT" ? t("people.chatDefaultMessage") : t("people.inviteDefaultMessage");
        const friendFallback = composer.mode === "FRIEND" ? t("people.friendDefaultMessage") : fallback;
        const message = normalizeShortMessage(composer.message, friendFallback);
        if (composer.mode === "INVITE" && !composer.selectedTeamId) {
            setComposer((prev) => ({ ...prev, error: t("people.selectTeam") }));
            return;
        }

        setComposer((prev) => ({ ...prev, isSubmitting: true, error: "" }));

        try {
            const body =
                composer.mode === "CHAT"
                    ? { type: "CHAT", toId: profile.userId, message }
                    : composer.mode === "FRIEND"
                        ? { type: "FRIEND", toId: profile.userId, message }
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
                if (composer.mode === "FRIEND") {
                    setProfile((prev) =>
                        prev
                            ? {
                                ...prev,
                                canRequestFriend: false,
                                friendState: "PENDING",
                            }
                            : prev
                    );
                }
                setComposer((prev) => ({ ...prev, isOpen: false, isSubmitting: false, error: "" }));
                return;
            }

            if (res.status === 409) {
                if (composer.mode === "CHAT" || composer.mode === "FRIEND") {
                    await loadProfile(true);
                    openNotice(t("discovery.notice.alreadyRequestedTitle"), data.error || t("people.requestExists"));
                    setComposer((prev) => ({ ...prev, isOpen: false, isSubmitting: false, error: "" }));
                    return;
                }
                setComposer((prev) => ({
                    ...prev,
                    isSubmitting: false,
                    error: data.error || t("people.requestExists"),
                }));
                return;
            }

            setComposer((prev) => ({
                ...prev,
                isSubmitting: false,
                error: data.error || t("people.sendFailed"),
            }));
        } catch (e) {
            console.error(e);
            setComposer((prev) => ({ ...prev, isSubmitting: false, error: t("people.sendFailed") }));
        }
    };

    const handleUnfriend = async () => {
        if (!profile || unfriendContext.isSubmitting) return;

        setUnfriendContext((prev) => ({ ...prev, isSubmitting: true }));
        try {
            const res = await fetch(`/api/friends/${encodeURIComponent(profile.userId)}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || t("people.unfriendFailed"));
            }

            setProfile((prev) =>
                prev ? {
                    ...prev,
                    friendState: "NONE",
                    canRequestFriend: true,
                } : prev
            );

            setNotice({
                open: true,
                title: t("people.friendRemovedTitle"),
                message: t("people.friendRemovedMessage", { username: profile.username }),
            });
        } catch (error: any) {
            setNotice({
                open: true,
                title: t("common.error"),
                message: error.message || t("people.unfriendFailed"),
            });
        } finally {
            setUnfriendContext({ isOpen: false, isSubmitting: false });
        }
    };

    if (loading) {
        return <div className="text-[var(--muted)]">{t("people.loadingProfile")}</div>;
    }

    if (error || !profile) {
        return (
            <div className="space-y-4">
                <Link href="/discovery" className="text-sm text-[var(--muted)] hover:text-[var(--fg)] inline-flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    {t("people.backToDiscovery")}
                </Link>
                <div className="text-red-500 text-sm">{error || t("people.profileNotFound")}</div>
            </div>
        );
    }

    return (
        <>
            <div className="max-w-3xl mx-auto space-y-6">
                <Link href="/discovery" className="text-sm text-[var(--muted)] hover:text-[var(--fg)] inline-flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    {t("people.backToDiscovery")}
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
                                {profile.canRequestFriend ? (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-xs px-3 text-[var(--fg)] hover:border-[var(--border)] hover:bg-[var(--card-bg-hover)]"
                                        onClick={() => {
                                            trackProfileAction("discovery.profile_add_friend", {
                                                profileUserId: profile.userId,
                                            });
                                            openFriendComposer();
                                        }}
                                    >
                                        {t("people.friend")}
                                    </Button>
                                ) : profile.friendState === "ACCEPTED" ? (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-xs px-3 text-rose-500 hover:border-rose-500 hover:bg-rose-500/10"
                                        onClick={() => {
                                            trackProfileAction("profile.unfriend_click", {
                                                profileUserId: profile.userId,
                                            });
                                            setUnfriendContext({ isOpen: true, isSubmitting: false });
                                        }}
                                    >
                                        {t("people.unfriend")}
                                    </Button>
                                ) : (
                                    <span className="h-8 px-3 inline-flex items-center rounded border border-[var(--border)] text-[10px] font-medium text-[var(--muted)]">
                                        {t("people.friendRequested")}
                                    </span>
                                )}
                                {profile.canRequestChat || profile.friendState === "ACCEPTED" || profile.chatState === "ACCEPTED" ? (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-xs px-3 text-[var(--fg)] hover:border-[var(--border)] hover:bg-[var(--card-bg-hover)]"
                                        onClick={() => {
                                            trackProfileAction("discovery.profile_chat", {
                                                profileUserId: profile.userId,
                                            });
                                            openChatComposer();
                                        }}
                                    >
                                        {t("people.chat")}
                                    </Button>
                                ) : (
                                    <span className="h-8 px-3 inline-flex items-center rounded border border-[var(--border)] text-[10px] font-medium text-[var(--muted)]">
                                        {t("people.requested")}
                                    </span>
                                )}
                                {profile.canInvite && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-xs px-3 text-[var(--fg)] hover:border-[var(--border)] hover:bg-[var(--card-bg-hover)]"
                                        onClick={() => {
                                            trackProfileAction("discovery.profile_invite", {
                                                profileUserId: profile.userId,
                                            });
                                            void openInviteComposer();
                                        }}
                                    >
                                        {t("people.invite")}
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
                        <h2 className="text-sm font-semibold text-[var(--fg)]">{t("people.bio")}</h2>
                        <p className="text-sm text-[var(--muted)] whitespace-pre-wrap">
                            {profile.bio || t("discovery.noBioYet")}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-sm font-semibold text-[var(--fg)]">{t("people.skills")}</h2>
                        <div className="flex flex-wrap gap-2">
                            {profile.skills.length > 0 ? (
                                profile.skills.map((skill) => (
                                    <span key={skill} className="text-xs px-2 py-1 rounded bg-[var(--card-bg-hover)] border border-[var(--border)] text-[var(--fg)]">
                                        {skill}
                                    </span>
                                ))
                            ) : (
                                <span className="text-sm text-[var(--muted)]">{t("discovery.noSkillsYet")}</span>
                            )}
                        </div>
                    </div>

                    <div className="text-sm text-[var(--muted)]">
                        {profile.availabilityHours || "-"} / {t("people.perWeek")}
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
                                {composer.mode === "CHAT"
                                    ? t("people.sendChatRequest")
                                    : composer.mode === "FRIEND"
                                        ? t("people.sendFriendRequest")
                                        : t("people.sendTeamInvite")}
                            </h3>
                            <p className="text-xs text-[var(--muted)] mt-1 truncate">
                                {t("people.toPrefix", { name: profile.username })}
                            </p>
                        </div>

                        <div className="px-5 py-4 space-y-3">
                            {composer.mode === "INVITE" && (
                                <div className="space-y-1">
                                    <label className="text-xs text-[var(--muted)]">{t("people.teamLabel")}</label>
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
                                <label className="text-xs text-[var(--muted)]">{t("people.messageLabel")}</label>
                                <textarea
                                    value={composer.message}
                                    onChange={(event) =>
                                        setComposer((prev) => ({ ...prev, message: event.target.value.slice(0, 160) }))
                                    }
                                    rows={4}
                                    className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                                    placeholder={
                                        composer.mode === "CHAT"
                                            ? t("people.chatPlaceholder")
                                            : composer.mode === "FRIEND"
                                                ? t("people.friendPlaceholder")
                                                : t("people.invitePlaceholder")
                                    }
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
                                {t("people.cancel")}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => void submitComposer()}
                                disabled={composer.isSubmitting}
                            >
                                {composer.isSubmitting ? t("people.sending") : t("people.send")}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {unfriendContext.isOpen && profile && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 backdrop-blur-sm px-4"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setUnfriendContext((prev) => (prev.isSubmitting ? prev : { isOpen: false, isSubmitting: false }));
                        }
                    }}
                >
                    <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] shadow-2xl overflow-hidden">
                        <div className="px-6 py-6 text-center">
                            <h3 className="mb-2 text-lg font-semibold text-[var(--fg)]">{t("people.removeFriendTitle")}</h3>
                            <p className="text-sm text-[var(--muted)]">
                                {t("people.removeFriendMessage", { username: profile.username })}
                            </p>
                        </div>
                        <div className="flex border-t border-[var(--border)]">
                            <button
                                type="button"
                                className="flex-1 py-3 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--card-bg-hover)] focus:outline-none disabled:opacity-50"
                                onClick={() => setUnfriendContext({ isOpen: false, isSubmitting: false })}
                                disabled={unfriendContext.isSubmitting}
                            >
                                {t("people.cancel")}
                            </button>
                            <div className="w-px bg-[var(--border)]" />
                            <button
                                type="button"
                                className="flex-1 py-3 text-sm font-semibold text-rose-500 hover:bg-rose-500/10 focus:outline-none disabled:opacity-50"
                                onClick={() => void handleUnfriend()}
                                disabled={unfriendContext.isSubmitting}
                            >
                                {unfriendContext.isSubmitting ? t("people.removing") : t("people.remove")}
                            </button>
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
