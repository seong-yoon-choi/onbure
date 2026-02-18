"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Compass, Inbox, MessageSquare, LogOut, ChevronDown, User as UserIcon, Search, Plus } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCallback, useEffect, useRef, useState } from "react";
import ChatWidget from "@/components/chat/ChatWidget";
import CreateTeamModal from "@/components/teams/CreateTeamModal";
import RequestsModal from "@/components/requests/RequestsModal";

const navItems = [
    { href: "/discovery", label: "Discovery", icon: Compass },
    { href: "/requests", label: "Requests", icon: Inbox },
    { href: "/chat", label: "Chat", icon: MessageSquare },
];

interface OpenChatDmRequest {
    userId: string;
    username?: string;
    token: number;
}

interface ChatThreadListItem {
    threadId: string;
    type: "DM" | "TEAM";
    lastMessageAt?: string;
    dmSeenMap?: Record<string, number>;
    teamId?: string | null;
}

interface ChatMessageListItem {
    senderId?: string;
    createdAt?: string;
}

interface DmUserListItem {
    userId: string;
}

interface TeamListItem {
    teamId: string;
}

interface RequestsPayload {
    requests?: Array<unknown>;
}

function toEpochMs(value: string | number | Date | null | undefined): number {
    if (!value) return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (value instanceof Date) {
        const ms = value.getTime();
        return Number.isFinite(ms) ? ms : 0;
    }
    const ms = Date.parse(String(value));
    return Number.isFinite(ms) ? ms : 0;
}

function readSeenMap(storageKey: string): Record<string, number> {
    if (typeof window === "undefined" || !storageKey) return {};
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (!parsed || typeof parsed !== "object") return {};

        const normalized: Record<string, number> = {};
        for (const [threadId, value] of Object.entries(parsed)) {
            const epoch = toEpochMs(value as string | number | Date | null | undefined);
            if (threadId && epoch > 0) normalized[threadId] = epoch;
        }
        return normalized;
    } catch {
        return {};
    }
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { data: session, status: sessionStatus } = useSession();
    const currentUserId = (session?.user as { id?: string } | undefined)?.id || "";
    const [teamOpen, setTeamOpen] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isRequestsOpen, setIsRequestsOpen] = useState(false);
    const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
    const [openChatDmRequest, setOpenChatDmRequest] = useState<OpenChatDmRequest | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [myTeams, setMyTeams] = useState<Array<{ teamId: string; teamName: string; role: "Owner" | "Admin" | "Member"; status: "Active" | "Inactive" }>>([]);
    const [teamsLoading, setTeamsLoading] = useState(false);
    const [hasRequestsAlert, setHasRequestsAlert] = useState(false);
    const [hasChatAlert, setHasChatAlert] = useState(false);
    const teamMenuRef = useRef<HTMLDivElement | null>(null);
    const chatAlertFetchSeqRef = useRef(0);
    const isWorkspacePage = pathname.startsWith("/workspace");

    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            if (!teamMenuRef.current) return;
            const target = event.target as Node | null;
            if (target && !teamMenuRef.current.contains(target)) {
                setTeamOpen(false);
            }
        };

        document.addEventListener("mousedown", handlePointerDown);
        return () => document.removeEventListener("mousedown", handlePointerDown);
    }, []);

    const fetchMyTeams = async () => {
        setTeamsLoading(true);
        try {
            const res = await fetch("/api/teams");
            if (!res.ok) return;
            const data = (await res.json()) as Array<{ teamId: string; teamName: string; role: "Owner" | "Admin" | "Member"; status: "Active" | "Inactive" }>;
            setMyTeams(data || []);
        } catch (e) {
            console.error("Failed to load my teams", e);
        } finally {
            setTeamsLoading(false);
        }
    };

    useEffect(() => {
        if (sessionStatus !== "authenticated") return;
        void fetchMyTeams();
    }, [sessionStatus]);

    const fetchRequestsAlert = useCallback(async () => {
        if (sessionStatus !== "authenticated") {
            setHasRequestsAlert(false);
            return;
        }
        if (typeof document !== "undefined" && document.visibilityState !== "visible") {
            return;
        }

        try {
            const res = await fetch("/api/requests");
            if (!res.ok) {
                setHasRequestsAlert(false);
                return;
            }
            const payload = (await res.json()) as RequestsPayload;
            setHasRequestsAlert(Array.isArray(payload.requests) && payload.requests.length > 0);
        } catch {
            setHasRequestsAlert(false);
        }
    }, [sessionStatus]);

    const fetchChatAlert = useCallback(async () => {
        const fetchSeq = ++chatAlertFetchSeqRef.current;
        const setChatAlertSafely = (value: boolean) => {
            if (chatAlertFetchSeqRef.current === fetchSeq) {
                setHasChatAlert(value);
            }
        };

        if (sessionStatus !== "authenticated" || !currentUserId) {
            setChatAlertSafely(false);
            return;
        }
        if (isChatOpen) {
            setChatAlertSafely(false);
            return;
        }
        if (typeof document !== "undefined" && document.visibilityState !== "visible") {
            return;
        }

        try {
            const threadById = new Map<string, ChatThreadListItem>();
            const addThreadCandidate = (candidate: Partial<ChatThreadListItem> | null | undefined, fallbackType: "DM" | "TEAM") => {
                const threadId = String(candidate?.threadId || "").trim();
                if (!threadId) return;

                const prev = threadById.get(threadId);
                const merged: ChatThreadListItem = {
                    threadId,
                    type: (String(candidate?.type || fallbackType).toUpperCase() === "TEAM" ? "TEAM" : "DM"),
                    lastMessageAt: candidate?.lastMessageAt || prev?.lastMessageAt || "",
                    dmSeenMap: (candidate?.dmSeenMap as Record<string, number> | undefined) || prev?.dmSeenMap || {},
                    teamId: (candidate?.teamId as string | null | undefined) ?? prev?.teamId ?? null,
                };
                threadById.set(threadId, merged);
            };

            const [dmUsersRes, teamsRes] = await Promise.all([
                fetch("/api/chat/dm-users"),
                fetch("/api/chat/teams"),
            ]);

            const dmUsers = dmUsersRes.ok
                ? (await dmUsersRes.json()) as DmUserListItem[]
                : [];
            const teams = teamsRes.ok
                ? (await teamsRes.json()) as TeamListItem[]
                : [];

            if (dmUsers.length > 0) {
                const dmThreads = await Promise.all(
                    dmUsers.map(async (user) => {
                        if (!user?.userId) return null;
                        const res = await fetch("/api/chat/thread/dm", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ otherUserId: user.userId }),
                        });
                        if (!res.ok) return null;
                        return (await res.json()) as ChatThreadListItem;
                    })
                );
                for (const thread of dmThreads) {
                    addThreadCandidate(thread, "DM");
                }
            }

            if (teams.length > 0) {
                const teamThreads = await Promise.all(
                    teams.map(async (team) => {
                        if (!team?.teamId) return null;
                        const res = await fetch("/api/chat/thread/team", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ teamId: team.teamId }),
                        });
                        if (!res.ok) return null;
                        return (await res.json()) as ChatThreadListItem;
                    })
                );
                for (const thread of teamThreads) {
                    addThreadCandidate(thread, "TEAM");
                }
            }

            const dmSeenMapLocal = readSeenMap(`onbure.chatWidget.dmSeenMap.${currentUserId}`);
            const teamSeenMap = readSeenMap(`onbure.chatWidget.teamSeenMap.${currentUserId}`);
            const threads = Array.from(threadById.values());
            if (threads.length === 0) {
                setChatAlertSafely(false);
                return;
            }

            for (const thread of threads) {
                const threadId = thread?.threadId || "";
                if (!threadId) continue;

                const seenAt = thread.type === "DM"
                    ? Math.max(
                        Number(thread.dmSeenMap?.[currentUserId] || 0),
                        Number(dmSeenMapLocal[threadId] || 0)
                    )
                    : Number(teamSeenMap[threadId] || 0);

                const messagesRes = await fetch(`/api/chat/messages?threadId=${encodeURIComponent(threadId)}`);
                if (!messagesRes.ok) continue;
                const messages = (await messagesRes.json()) as ChatMessageListItem[];

                const hasUnread = Array.isArray(messages) && messages.some((message) => {
                    const senderId = String(message.senderId || "").trim();
                    const isFromOther = Boolean(senderId) && senderId !== currentUserId;
                    const createdAtEpoch = toEpochMs(message.createdAt);
                    return isFromOther && createdAtEpoch > seenAt;
                });

                if (hasUnread) {
                    setChatAlertSafely(true);
                    return;
                }
            }

            setChatAlertSafely(false);
        } catch {
            setChatAlertSafely(false);
        }
    }, [sessionStatus, currentUserId, isChatOpen]);

    const refreshTopbarAlerts = useCallback(() => {
        if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
        void fetchRequestsAlert();
        void fetchChatAlert();
    }, [fetchRequestsAlert, fetchChatAlert]);

    useEffect(() => {
        if (sessionStatus !== "authenticated") {
            setHasRequestsAlert(false);
            setHasChatAlert(false);
            setIsRequestsOpen(false);
            return;
        }

        refreshTopbarAlerts();
        const intervalId = window.setInterval(refreshTopbarAlerts, 15000);
        const onFocus = () => refreshTopbarAlerts();
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                refreshTopbarAlerts();
            }
        };

        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onVisibilityChange);
        window.addEventListener("onbure-chat-alert-refresh", onFocus as EventListener);
        window.addEventListener("onbure-requests-updated", onFocus as EventListener);
        window.addEventListener("onbure-chat-connections-updated", onFocus as EventListener);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener("onbure-chat-alert-refresh", onFocus as EventListener);
            window.removeEventListener("onbure-requests-updated", onFocus as EventListener);
            window.removeEventListener("onbure-chat-connections-updated", onFocus as EventListener);
        };
    }, [sessionStatus, refreshTopbarAlerts]);

    useEffect(() => {
        if (sessionStatus !== "authenticated") return;
        refreshTopbarAlerts();
    }, [pathname, isChatOpen, sessionStatus, refreshTopbarAlerts]);

    useEffect(() => {
        const onTeamsUpdated = () => {
            void fetchMyTeams();
        };

        window.addEventListener("onbure-teams-updated", onTeamsUpdated);
        return () => window.removeEventListener("onbure-teams-updated", onTeamsUpdated);
    }, []);

    useEffect(() => {
        const onOpenChatDm = (event: Event) => {
            const customEvent = event as CustomEvent<{ userId?: string; username?: string }>;
            const userId = customEvent.detail?.userId || "";
            if (!userId) return;

            setOpenChatDmRequest({
                userId,
                username: customEvent.detail?.username,
                token: Date.now(),
            });
            setIsChatOpen(true);
        };

        window.addEventListener("onbure-open-chat-dm", onOpenChatDm as EventListener);
        return () => window.removeEventListener("onbure-open-chat-dm", onOpenChatDm as EventListener);
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.push(`/discovery?q=${encodeURIComponent(searchTerm)}`);
    };

    return (
        <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] flex flex-col">
            {/* Topbar */}
            <header className="h-16 border-b border-[var(--border)] bg-[var(--header-bg)] backdrop-blur-md sticky top-0 z-50 grid grid-cols-[auto_1fr_auto] items-center px-6 gap-8">
                {/* Left: Logo & Nav */}
                <div className="flex items-center gap-8">
                    <Link href="/discovery" className="text-xl font-bold bg-gradient-to-r from-violet-500 to-emerald-500 bg-clip-text text-transparent shrink-0">
                        Onbure
                    </Link>

                    <nav className="hidden md:flex items-center gap-4">
                        {navItems
                            .filter((item) => item.label === "Discovery")
                            .map((item) => {
                                const Icon = item.icon;
                                const isActive = pathname.startsWith(item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                                            isActive
                                                ? "bg-[var(--card-bg)] text-[var(--fg)] border border-[var(--border)]"
                                                : "text-[var(--muted)] hover:text-[var(--fg)]"
                                        )}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {item.label}
                                    </Link>
                                );
                            })}

                        <div className="relative" ref={teamMenuRef}>
                            <button
                                onClick={() => setTeamOpen(!teamOpen)}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                                    pathname.startsWith("/workspace") || pathname.startsWith("/teams")
                                        ? "bg-[var(--card-bg)] text-[var(--fg)] border border-[var(--border)]"
                                        : "text-[var(--muted)] hover:text-[var(--fg)]"
                                )}
                            >
                                My Teams <ChevronDown className="w-4 h-4" />
                            </button>
                            {teamOpen && (
                                <div className="absolute top-full left-0 mt-2 w-64 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg shadow-xl p-2 z-50">
                                    <p className="text-xs text-[var(--muted)] px-2 py-1">Select Team</p>
                                    <div className="max-h-52 overflow-auto py-1 space-y-1">
                                        {teamsLoading ? (
                                            <p className="px-2 py-1.5 text-xs text-[var(--muted)]">Loading...</p>
                                        ) : myTeams.length === 0 ? (
                                            <p className="px-2 py-1.5 text-xs text-[var(--muted)]">No teams yet.</p>
                                        ) : (
                                            myTeams.map((team) => (
                                                <Link
                                                    key={`${team.teamId}:${team.role}`}
                                                    href={`/workspace/${encodeURIComponent(team.teamId)}`}
                                                    onClick={() => setTeamOpen(false)}
                                                    className="block px-2 py-1.5 rounded hover:bg-[var(--card-bg-hover)]"
                                                >
                                                    <p className="text-sm text-[var(--fg)] truncate">{team.teamName}</p>
                                                    <p className="text-[10px] text-[var(--muted)] mt-0.5">{team.role}</p>
                                                </Link>
                                            ))
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTeamOpen(false);
                                            setIsCreateTeamOpen(true);
                                        }}
                                        className="mt-1 w-full flex items-center gap-2 px-2 py-1.5 text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)] rounded"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        create team
                                    </button>
                                </div>
                            )}
                        </div>

                    </nav>
                </div>

                {/* Center: Search */}
                <div className="max-w-md w-full justify-self-center">
                    <form onSubmit={handleSearch} className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--muted)]" />
                        <Input
                            placeholder="Search teams & people..."
                            className="pl-9 h-9 text-sm transition-colors w-full"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </form>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-4 justify-end">
                    {/* Requests Button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn("relative text-[var(--muted)] hover:text-[var(--fg)]", isRequestsOpen && "text-[var(--primary)] bg-[var(--primary)]/10")}
                        onClick={() => {
                            setIsRequestsOpen((prev) => !prev);
                            setHasRequestsAlert(false);
                        }}
                    >
                        <Inbox className="w-4 h-4 mr-2" />
                        Requests
                        {hasRequestsAlert && !isRequestsOpen && (
                            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500 ring-1 ring-[var(--header-bg)]" />
                        )}
                    </Button>

                    {/* Chat Button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn("relative text-[var(--muted)] hover:text-[var(--fg)]", isChatOpen && "text-[var(--primary)] bg-[var(--primary)]/10")}
                        onClick={() => setIsChatOpen(!isChatOpen)}
                    >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Chat
                        {hasChatAlert && (
                            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500 ring-1 ring-[var(--header-bg)]" />
                        )}
                    </Button>

                    <div className="h-6 w-px bg-[var(--border)] mx-2" />

                    {/* Profile & Logout */}
                    <div className="flex items-center gap-3">
                        <Link href="/profile" className="h-8 w-8 rounded-full bg-[var(--primary)]/15 flex items-center justify-center text-[var(--primary)] text-xs font-bold hover:ring-2 hover:ring-[var(--ring)]/40 transition-all">
                            {session?.user?.name?.[0] || <UserIcon className="w-4 h-4" />}
                        </Link>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-[var(--muted)] hover:text-red-500 w-8 h-8"
                            onClick={() => signOut({ callbackUrl: "/login" })}
                        >
                            <LogOut className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className={cn("flex-1 relative min-h-0", isWorkspacePage && "overflow-hidden")}>
                {/* Background Grid */}
                <div className="absolute inset-0 z-0 pointer-events-none bg-[url('/grid.svg')] bg-[size:30px_30px] opacity-20 dark:opacity-10" />
                <div
                    className={cn(
                        "relative z-10 h-full min-h-0",
                        isWorkspacePage
                            ? "w-full"
                            : "p-6 max-w-6xl mx-auto"
                    )}
                >
                    {children}
                </div>
            </main>

            {/* Global Chat Modal */}
            <RequestsModal
                isOpen={isRequestsOpen}
                onClose={() => setIsRequestsOpen(false)}
            />
            <ChatWidget
                isOpen={isChatOpen}
                onClose={() => setIsChatOpen(false)}
                openDmRequest={openChatDmRequest}
            />
            <CreateTeamModal
                open={isCreateTeamOpen}
                onClose={() => setIsCreateTeamOpen(false)}
                onCreated={(teamId) => {
                    setIsCreateTeamOpen(false);
                    void fetchMyTeams();
                    router.push(`/workspace/${encodeURIComponent(teamId)}`);
                }}
            />
        </div>
    );
}
