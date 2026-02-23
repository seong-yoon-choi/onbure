"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquare, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertModal } from "@/components/ui/modal";
import { trackUxClick } from "@/lib/ux/client";

interface FriendItem {
    userId: string;
    username: string;
    language?: string;
    country?: string;
    skills?: string[];
}

function openDmThread(friend: FriendItem) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
        new CustomEvent("onbure-open-chat-dm", {
            detail: {
                userId: friend.userId,
                username: friend.username,
            },
        })
    );
}

export default function FriendsPage() {
    const [loading, setLoading] = useState(true);
    const [friends, setFriends] = useState<FriendItem[]>([]);
    const [myTeams, setMyTeams] = useState<Array<{ teamId: string; name: string }> | null>(null);
    const [notice, setNotice] = useState<{ open: boolean; title: string; message: string }>({
        open: false,
        title: "",
        message: "",
    });
    const [composer, setComposer] = useState<{
        isOpen: boolean;
        toUserId: string;
        toUsername: string;
        message: string;
        selectedTeamId: string;
        teamOptions: Array<{ teamId: string; name: string }>;
        isSubmitting: boolean;
        error: string;
    }>({
        isOpen: false,
        toUserId: "",
        toUsername: "",
        message: "I'd like to invite you to my team.",
        selectedTeamId: "",
        teamOptions: [],
        isSubmitting: false,
        error: "",
    });
    const [contextMenu, setContextMenu] = useState<{
        isOpen: boolean;
        x: number;
        y: number;
        friend: FriendItem | null;
    }>({
        isOpen: false,
        x: 0,
        y: 0,
        friend: null,
    });
    const [unfriendContext, setUnfriendContext] = useState<{
        friend: FriendItem | null;
        isSubmitting: boolean;
    }>({
        friend: null,
        isSubmitting: false,
    });

    const trackFriendsAction = (actionKey: string, context?: Record<string, unknown>) => {
        trackUxClick(actionKey, {
            page: "friends",
            ...context,
        });
    };

    const fetchFriends = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/friends", { cache: "no-store" });
            if (!res.ok) {
                setFriends([]);
                return;
            }
            const data = (await res.json()) as FriendItem[];
            setFriends(Array.isArray(data) ? data : []);
        } catch {
            setFriends([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchFriends();
    }, [fetchFriends]);

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

    useEffect(() => {
        if (!contextMenu.isOpen) return;
        const handleClickOutside = () => {
            setContextMenu({ isOpen: false, x: 0, y: 0, friend: null });
        };
        window.addEventListener("click", handleClickOutside);
        return () => window.removeEventListener("click", handleClickOutside);
    }, [contextMenu.isOpen]);

    const handleContextMenu = (e: React.MouseEvent, friend: FriendItem) => {
        e.preventDefault();
        setContextMenu({
            isOpen: true,
            x: e.clientX,
            y: e.clientY,
            friend,
        });
    };

    const sortedFriends = useMemo(
        () => [...friends].sort((a, b) => a.username.localeCompare(b.username)),
        [friends]
    );

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

    const openInviteComposer = async (friend: FriendItem) => {
        try {
            const options = await getMyTeams();
            if (!options.length) {
                setNotice({
                    open: true,
                    title: "Invite unavailable",
                    message: "You need at least one team to send an invite.",
                });
                return;
            }
            setComposer({
                isOpen: true,
                toUserId: friend.userId,
                toUsername: friend.username,
                message: "I'd like to invite you to my team.",
                selectedTeamId: options[0].teamId,
                teamOptions: options,
                isSubmitting: false,
                error: "",
            });
        } catch {
            setNotice({
                open: true,
                title: "Failed to load teams",
                message: "Please try again in a moment.",
            });
        }
    };

    const submitInvite = async () => {
        if (!composer.isOpen || composer.isSubmitting) return;
        if (!composer.selectedTeamId) {
            setComposer((prev) => ({ ...prev, error: "Please select a team." }));
            return;
        }
        setComposer((prev) => ({ ...prev, isSubmitting: true, error: "" }));

        try {
            const res = await fetch("/api/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "INVITE",
                    toId: composer.toUserId,
                    teamId: composer.selectedTeamId,
                    message: normalizeShortMessage(composer.message, "I'd like to invite you to my team."),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setComposer((prev) => ({ ...prev, isOpen: false, isSubmitting: false, error: "" }));
                return;
            }
            setComposer((prev) => ({
                ...prev,
                isSubmitting: false,
                error: String(data?.error || "Failed to send invite."),
            }));
        } catch {
            setComposer((prev) => ({ ...prev, isSubmitting: false, error: "Failed to send invite." }));
        }
    };

    const handleUnfriend = async () => {
        const friend = unfriendContext.friend;
        if (!friend || unfriendContext.isSubmitting) return;

        setUnfriendContext((prev) => ({ ...prev, isSubmitting: true }));
        try {
            const res = await fetch(`/api/friends/${encodeURIComponent(friend.userId)}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to unfriend.");
            }
            setFriends((prev) => prev.filter((f) => f.userId !== friend.userId));
            setNotice({
                open: true,
                title: "Friend removed",
                message: `${friend.username} has been removed from your friends list.`,
            });
        } catch (error: any) {
            setNotice({
                open: true,
                title: "Error",
                message: error.message || "Failed to remove friend.",
            });
        } finally {
            setUnfriendContext({ friend: null, isSubmitting: false });
        }
    };

    return (
        <div className="mx-auto w-full max-w-2xl space-y-4">
            <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[var(--primary)]" />
                <h1 className="text-2xl font-bold text-[var(--fg)]">Friends</h1>
            </div>
            <p className="text-sm text-[var(--muted)]">
                Your accepted friend list.
            </p>

            {loading ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 text-sm text-[var(--muted)]">
                    Loading friends...
                </div>
            ) : sortedFriends.length === 0 ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 text-sm text-[var(--muted)]">
                    No friends yet.
                </div>
            ) : (
                <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card-bg)]">
                    {sortedFriends.map((friend) => (
                        <div
                            key={friend.userId}
                            className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 last:border-b-0"
                            onContextMenu={(e) => handleContextMenu(e, friend)}
                        >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card-bg-hover)] text-sm font-semibold text-[var(--fg)]">
                                {(friend.username || "?").slice(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-[var(--fg)]">
                                    {friend.username || "Unknown"}
                                </div>
                                <div className="truncate text-xs text-[var(--muted)]">
                                    {[friend.country, friend.language].filter(Boolean).join(" · ") || "No details"}
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                                <Link
                                    href={`/people/${encodeURIComponent(friend.userId)}`}
                                    onClick={() =>
                                        trackFriendsAction("friends.open_profile", { userId: friend.userId })
                                    }
                                    className="inline-flex h-8 items-center rounded-md border border-[var(--border)] px-2.5 text-[11px] text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                                >
                                    Profile
                                </Link>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-8 px-2.5 text-[11px]"
                                    onClick={() => {
                                        trackFriendsAction("friends.chat", { userId: friend.userId });
                                        openDmThread(friend);
                                    }}
                                >
                                    <MessageSquare className="mr-1 h-3.5 w-3.5" />
                                    Chat
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-8 px-2.5 text-[11px]"
                                    onClick={() => {
                                        trackFriendsAction("friends.invite", { userId: friend.userId });
                                        void openInviteComposer(friend);
                                    }}
                                >
                                    Invite
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {composer.isOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm px-4"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setComposer((prev) => (prev.isSubmitting ? prev : { ...prev, isOpen: false, error: "" }));
                        }
                    }}
                >
                    <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] shadow-2xl">
                        <div className="border-b border-[var(--border)] px-5 py-4">
                            <h3 className="text-base font-semibold text-[var(--fg)]">Send Team Invite</h3>
                            <p className="mt-1 truncate text-xs text-[var(--muted)]">To: {composer.toUsername}</p>
                        </div>
                        <div className="space-y-3 px-5 py-4">
                            <div className="space-y-1">
                                <label className="text-xs text-[var(--muted)]">Team</label>
                                <select
                                    value={composer.selectedTeamId}
                                    onChange={(event) =>
                                        setComposer((prev) => ({ ...prev, selectedTeamId: event.target.value }))
                                    }
                                    className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--fg)] focus:outline-none"
                                >
                                    {composer.teamOptions.map((team) => (
                                        <option key={team.teamId} value={team.teamId}>
                                            {team.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-[var(--muted)]">Message</label>
                                <textarea
                                    value={composer.message}
                                    onChange={(event) =>
                                        setComposer((prev) => ({ ...prev, message: event.target.value.slice(0, 160) }))
                                    }
                                    rows={4}
                                    className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                                    placeholder="Write a short invite message..."
                                />
                                <div className="text-right text-[10px] text-[var(--muted)]">{composer.message.length}/160</div>
                            </div>
                            {composer.error && <p className="text-xs text-rose-500">{composer.error}</p>}
                        </div>
                        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                    setComposer((prev) => (prev.isSubmitting ? prev : { ...prev, isOpen: false, error: "" }))
                                }
                                disabled={composer.isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => void submitInvite()}
                                disabled={composer.isSubmitting}
                            >
                                {composer.isSubmitting ? "Sending..." : "Send"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {contextMenu.isOpen && contextMenu.friend && (
                <div
                    className="fixed z-50 w-48 rounded-md border border-[var(--border)] bg-[var(--card-bg)] shadow-lg"
                    style={{
                        top: Math.min(contextMenu.y, (typeof window !== "undefined" ? window.innerHeight : 1000) - 100),
                        left: Math.min(contextMenu.x, (typeof window !== "undefined" ? window.innerWidth : 1000) - 200),
                    }}
                >
                    <div className="py-1">
                        <Link
                            href={`/people/${encodeURIComponent(contextMenu.friend.userId)}`}
                            onClick={() => {
                                trackFriendsAction("friends.context_menu_open_profile", { userId: contextMenu.friend!.userId });
                                setContextMenu({ isOpen: false, x: 0, y: 0, friend: null });
                            }}
                            className="block w-full px-4 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                        >
                            View Profile
                        </Link>
                        <button
                            type="button"
                            onClick={() => {
                                trackFriendsAction("friends.context_menu_unfriend", { userId: contextMenu.friend!.userId });
                                setUnfriendContext({ friend: contextMenu.friend, isSubmitting: false });
                                setContextMenu({ isOpen: false, x: 0, y: 0, friend: null });
                            }}
                            className="block w-full px-4 py-2 text-left text-sm text-rose-500 hover:bg-rose-500/10 focus:outline-none"
                        >
                            Unfriend
                        </button>
                    </div>
                </div>
            )}

            {unfriendContext.friend && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 backdrop-blur-sm px-4"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setUnfriendContext((prev) => (prev.isSubmitting ? prev : { friend: null, isSubmitting: false }));
                        }
                    }}
                >
                    <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] shadow-2xl overflow-hidden">
                        <div className="px-6 py-6 text-center">
                            <h3 className="mb-2 text-lg font-semibold text-[var(--fg)]">Remove Friend?</h3>
                            <p className="text-sm text-[var(--muted)]">
                                Are you sure you want to remove <strong>{unfriendContext.friend.username}</strong> from your friends list?
                            </p>
                        </div>
                        <div className="flex border-t border-[var(--border)]">
                            <button
                                type="button"
                                className="flex-1 py-3 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--card-bg-hover)] focus:outline-none disabled:opacity-50"
                                onClick={() => setUnfriendContext({ friend: null, isSubmitting: false })}
                                disabled={unfriendContext.isSubmitting}
                            >
                                Cancel
                            </button>
                            <div className="w-px bg-[var(--border)]" />
                            <button
                                type="button"
                                className="flex-1 py-3 text-sm font-semibold text-rose-500 hover:bg-rose-500/10 focus:outline-none disabled:opacity-50"
                                onClick={() => void handleUnfriend()}
                                disabled={unfriendContext.isSubmitting}
                            >
                                {unfriendContext.isSubmitting ? "Removing..." : "Remove"}
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
        </div>
    );
}
