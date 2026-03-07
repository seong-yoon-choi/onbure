"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Compass, Bell, MessageSquare, LogOut, ChevronDown, User as UserIcon, Search, Plus, Users, CircleHelp } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChatWidget from "@/components/chat/ChatWidget";
import CreateTeamModal from "@/components/teams/CreateTeamModal";
import RequestsModal from "@/components/requests/RequestsModal";
import { useAuditRealtime } from "@/lib/realtime/use-audit-realtime";
import { trackUxClick } from "@/lib/ux/client";
import { useLanguage } from "@/components/providers";
import QnaFeedbackWidget from "@/components/qna-feedback/QnaFeedbackWidget";

const leftNavItems = [
    { href: "/", labelKey: "nav.discovery", icon: Compass, actionKey: "nav.discovery" },
    { href: "/friends", labelKey: "nav.friends", icon: Users, actionKey: "nav.friends" },
];

interface OpenChatDmRequest {
    userId: string;
    username?: string;
    token: number;
}

interface ChatThreadListItem {
    threadId: string;
    type: "DM" | "TEAM";
    participantsUserIds?: string[];
    lastMessageAt?: string;
    lastSenderId?: string;
    dmSeenMap?: Record<string, number>;
    teamId?: string | null;
    unreadCount?: number;
}

interface ChatAlertsPayload {
    threads?: ChatThreadListItem[];
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

function readStoredEpoch(storageKey: string): number {
    if (typeof window === "undefined" || !storageKey) return 0;
    try {
        const raw = String(localStorage.getItem(storageKey) || "").trim();
        if (!raw) return 0;
        const numeric = Number(raw);
        if (Number.isFinite(numeric) && numeric > 0) return Math.floor(numeric);
        const parsed = Date.parse(raw);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
        return 0;
    }
}

function writeStoredEpoch(storageKey: string, value: number) {
    if (typeof window === "undefined" || !storageKey) return;
    try {
        const normalized = Number.isFinite(value) && value > 0 ? Math.floor(value) : Date.now();
        localStorage.setItem(storageKey, String(normalized));
    } catch {
        // ignore storage write errors
    }
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { data: session, status: sessionStatus } = useSession();
    const { t } = useLanguage();
    const currentUserId = (session?.user as { id?: string } | undefined)?.id || "";
    const [teamOpen, setTeamOpen] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isQnaFeedbackOpen, setIsQnaFeedbackOpen] = useState(false);
    const [isRequestsOpen, setIsRequestsOpen] = useState(false);
    const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
    const [openChatDmRequest, setOpenChatDmRequest] = useState<OpenChatDmRequest | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    const isAdminUser = (session?.user as any)?.isAdmin === true;
    const [myTeams, setMyTeams] = useState<Array<{ teamId: string; teamName: string; role: "Owner" | "Admin" | "Member"; status: "Active" | "Inactive" }>>([]);
    const [teamsLoading, setTeamsLoading] = useState(false);
    const [hasRequestsAlert, setHasRequestsAlert] = useState(false);
    const [hasChatAlert, setHasChatAlert] = useState(false);
    const teamMenuRef = useRef<HTMLDivElement | null>(null);
    const chatAlertFetchSeqRef = useRef(0);
    const requestsAlertInFlightRef = useRef(false);
    const chatAlertInFlightRef = useRef(false);
    const chatAlertResetAtRef = useRef(0);
    const isWorkspacePage = pathname.startsWith("/workspace");
    const workspaceTeamId = useMemo(() => {
        const match = pathname.match(/^\/workspace\/([^/?#]+)/);
        return match?.[1] ? decodeURIComponent(match[1]) : "";
    }, [pathname]);
    const chatAlertResetStorageKey = currentUserId
        ? `onbure.chatTopbar.resetAt.${currentUserId}`
        : "";

    const trackNavAction = useCallback(
        (actionKey: string, context?: Record<string, unknown>) => {
            trackUxClick(actionKey, {
                pathname,
                ...context,
            });
        },
        [pathname]
    );

    const fetchWithTimeout = useCallback(async (url: string, timeoutMs = 7000) => {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, {
                signal: controller.signal,
                cache: "no-store",
            });
        } finally {
            window.clearTimeout(timer);
        }
    }, []);

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

    useEffect(() => {
        chatAlertResetAtRef.current = readStoredEpoch(chatAlertResetStorageKey);
    }, [chatAlertResetStorageKey]);

    const markChatAlertsChecked = useCallback((at?: number) => {
        const timestamp = Number.isFinite(Number(at)) && Number(at) > 0
            ? Math.floor(Number(at))
            : Date.now();
        chatAlertResetAtRef.current = timestamp;
        if (chatAlertResetStorageKey) {
            writeStoredEpoch(chatAlertResetStorageKey, timestamp);
        }
        setHasChatAlert(false);
    }, [chatAlertResetStorageKey]);

    const fetchRequestsAlert = useCallback(async () => {
        if (sessionStatus !== "authenticated") {
            setHasRequestsAlert(false);
            return;
        }
        if (typeof document !== "undefined" && document.visibilityState !== "visible") {
            return;
        }
        if (requestsAlertInFlightRef.current) return;
        requestsAlertInFlightRef.current = true;

        try {
            const res = await fetchWithTimeout("/api/requests");
            if (!res.ok) {
                setHasRequestsAlert(false);
                return;
            }
            const payload = (await res.json()) as RequestsPayload;
            setHasRequestsAlert(Array.isArray(payload.requests) && payload.requests.length > 0);
        } catch {
            setHasRequestsAlert(false);
        } finally {
            requestsAlertInFlightRef.current = false;
        }
    }, [sessionStatus, fetchWithTimeout]);

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
        if (chatAlertInFlightRef.current) return;
        chatAlertInFlightRef.current = true;
        if (isChatOpen) {
            setChatAlertSafely(false);
            chatAlertInFlightRef.current = false;
            return;
        }
        if (typeof document !== "undefined" && document.visibilityState !== "visible") {
            chatAlertInFlightRef.current = false;
            return;
        }

        try {
            const threadsRes = await fetchWithTimeout("/api/chat/alerts", 12000);
            if (!threadsRes.ok) {
                setChatAlertSafely(false);
                return;
            }
            const payload = (await threadsRes.json()) as ChatAlertsPayload;
            const threads = Array.isArray(payload.threads) ? payload.threads : [];
            const dmSeenMapLocal = readSeenMap(`onbure.chatWidget.dmSeenMap.${currentUserId}`);
            const teamSeenMap = readSeenMap(`onbure.chatWidget.teamSeenMap.${currentUserId}`);
            const alertResetAt = chatAlertResetAtRef.current;
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

                const senderId = String(thread.lastSenderId || "").trim();
                const isFromOther = Boolean(senderId) && senderId !== currentUserId;
                const latestAt = toEpochMs(thread.lastMessageAt);
                const isAfterLastCheck = latestAt > alertResetAt;
                const hasUnread =
                    isFromOther &&
                    isAfterLastCheck &&
                    (latestAt > seenAt || (thread.type === "DM" && Number(thread.unreadCount || 0) > 0));

                if (hasUnread) {
                    setChatAlertSafely(true);
                    return;
                }
            }

            setChatAlertSafely(false);
        } catch {
            setChatAlertSafely(false);
        } finally {
            chatAlertInFlightRef.current = false;
        }
    }, [sessionStatus, currentUserId, isChatOpen, fetchWithTimeout]);

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
            chatAlertResetAtRef.current = 0;
            return;
        }

        refreshTopbarAlerts();
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
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener("onbure-chat-alert-refresh", onFocus as EventListener);
            window.removeEventListener("onbure-requests-updated", onFocus as EventListener);
            window.removeEventListener("onbure-chat-connections-updated", onFocus as EventListener);
        };
    }, [sessionStatus, refreshTopbarAlerts]);

    useAuditRealtime(sessionStatus === "authenticated" && Boolean(currentUserId), (row) => {
        const category = String(row.category || "").toLowerCase();
        if (category !== "chat" && category !== "request" && category !== "team") return;

        const actorUserId = String(row.actor_user_id || "").trim();
        const targetUserId = String(row.target_user_id || "").trim();
        const eventName = String(row.event || "").trim().toLowerCase();
        const teamId = String(row.team_id || "").trim();
        const isMyTeamEvent = teamId.length > 0 && myTeams.some((team) => team.teamId === teamId);
        const isDirectUserEvent =
            actorUserId === currentUserId || targetUserId === currentUserId;

        const isTeamChatEvent =
            category === "chat" &&
            teamId.length > 0 &&
            (eventName.includes("chat") || eventName.includes("message"));
        if (isTeamChatEvent && myTeams.length === 0) {
            void fetchMyTeams();
            void fetchChatAlert();
            return;
        }

        if (!isDirectUserEvent && !isMyTeamEvent) return;
        if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

        if (category === "request" || eventName.includes("request")) {
            void fetchRequestsAlert();
        }
        if (category === "chat" || eventName.includes("chat") || eventName.includes("message")) {
            void fetchChatAlert();
        }
        if (category === "team" && eventName.includes("membership")) {
            void fetchMyTeams();
            void fetchChatAlert();
            void fetchRequestsAlert();
        } else if (category === "team" && eventName === "team_member_left") {
            void fetchMyTeams();
        }
    });

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
            markChatAlertsChecked();
            setIsChatOpen(true);
        };

        window.addEventListener("onbure-open-chat-dm", onOpenChatDm as EventListener);
        return () => window.removeEventListener("onbure-open-chat-dm", onOpenChatDm as EventListener);
    }, [markChatAlertsChecked]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedSearchTerm = searchTerm.trim();
        trackNavAction("nav.search", { keywordLength: trimmedSearchTerm.length });
        router.push(trimmedSearchTerm ? `/?q=${encodeURIComponent(trimmedSearchTerm)}` : "/");
    };

    return (
        <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] flex flex-col">
            {/* Topbar */}
            <header className="h-16 border-b border-[var(--border)] bg-[var(--header-bg)] backdrop-blur-md sticky top-0 z-50 grid grid-cols-[auto_1fr_auto] items-center px-6 gap-8">
                {/* Left: Logo & Nav */}
                <div className="flex items-center gap-8">
                    <Link href="/" className="text-xl font-bold bg-gradient-to-r from-violet-500 to-emerald-500 bg-clip-text text-transparent shrink-0">
                        Onbure
                    </Link>

                    <nav className="hidden md:flex items-center gap-4">
                        {leftNavItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = item.href === "/"
                                ? pathname === "/"
                                : pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => trackNavAction(item.actionKey)}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                                        isActive
                                            ? "bg-[var(--card-bg)] text-[var(--fg)] border border-[var(--border)]"
                                            : "text-[var(--muted)] hover:text-[var(--fg)]"
                                    )}
                                >
                                    <Icon className="w-4 h-4" />
                                    {t(item.labelKey)}
                                </Link>
                            );
                        })}

                        <div className="relative" ref={teamMenuRef}>
                            <button
                                onClick={(e) => {
                                    if (sessionStatus === "unauthenticated") {
                                        e.preventDefault();
                                        router.push("/login");
                                        return;
                                    }
                                    trackNavAction("nav.my_team");
                                    setTeamOpen(!teamOpen);
                                }}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                                    pathname.startsWith("/workspace") || pathname.startsWith("/teams")
                                        ? "bg-[var(--card-bg)] text-[var(--fg)] border border-[var(--border)]"
                                        : "text-[var(--muted)] hover:text-[var(--fg)]"
                                )}
                            >
                                {t("nav.myTeams")} <ChevronDown className="w-4 h-4" />
                            </button>
                            {teamOpen && (
                                <div className="absolute top-full left-0 mt-2 w-64 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg shadow-xl p-2 z-50">
                                    <p className="text-xs text-[var(--muted)] px-2 py-1">{t("nav.selectTeam")}</p>
                                    <div className="max-h-52 overflow-auto py-1 space-y-1">
                                        {teamsLoading ? (
                                            <p className="px-2 py-1.5 text-xs text-[var(--muted)]">{t("common.loading")}</p>
                                        ) : myTeams.length === 0 ? (
                                            <p className="px-2 py-1.5 text-xs text-[var(--muted)]">{t("nav.noTeamsYet")}</p>
                                        ) : (
                                            myTeams.map((team) => (
                                                <Link
                                                    key={`${team.teamId}:${team.role}`}
                                                    href={`/workspace/${encodeURIComponent(team.teamId)}`}
                                                    onClick={() => setTeamOpen(false)}
                                                    className="block px-2 py-1.5 rounded hover:bg-[var(--card-bg-hover)]"
                                                >
                                                    <p className="text-sm text-[var(--fg)] truncate">{team.teamName}</p>
                                                    <p className="text-[10px] text-[var(--muted)] mt-0.5">
                                                        {team.role === "Owner"
                                                            ? t("team.role.owner")
                                                            : team.role === "Admin"
                                                                ? t("team.role.admin")
                                                                : t("team.role.member")}
                                                    </p>
                                                </Link>
                                            ))
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            if (sessionStatus === "unauthenticated") {
                                                e.preventDefault();
                                                router.push("/login");
                                                return;
                                            }
                                            trackUxClick("myteam.dropdown_create_team", { source: "topbar_dropdown" });
                                            setTeamOpen(false);
                                            setIsCreateTeamOpen(true);
                                        }}
                                        className="mt-1 w-full flex items-center gap-2 px-2 py-1.5 text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)] rounded"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        {t("nav.createTeam")}
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
                            placeholder={t("nav.searchPlaceholder")}
                            className="pl-9 pr-20 h-9 text-sm transition-colors w-full"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Button
                            type="submit"
                            size="sm"
                            variant="ghost"
                            className="absolute right-1 top-1 h-7 px-2 text-xs text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                        >
                            {t("common.search")}
                        </Button>
                    </form>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-4 justify-end">
                    {/* Notices Button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn("relative text-[var(--muted)] hover:text-[var(--fg)]", isRequestsOpen && "text-[var(--primary)] bg-[var(--primary)]/10")}
                        onClick={(e) => {
                            if (sessionStatus === "unauthenticated") {
                                e.preventDefault();
                                router.push("/login");
                                return;
                            }
                            trackNavAction("nav.notice");
                            setIsRequestsOpen((prev) => !prev);
                            setHasRequestsAlert(false);
                        }}
                    >
                        <Bell className="w-4 h-4 mr-2" />
                        {t("nav.notices")}
                        {hasRequestsAlert && !isRequestsOpen && (
                            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500 ring-1 ring-[var(--header-bg)]" />
                        )}
                    </Button>

                    {/* Chat Button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn("relative text-[var(--muted)] hover:text-[var(--fg)]", isChatOpen && "text-[var(--primary)] bg-[var(--primary)]/10")}
                        onClick={(e) => {
                            if (sessionStatus === "unauthenticated") {
                                e.preventDefault();
                                router.push("/login");
                                return;
                            }
                            trackNavAction("nav.chat");
                            markChatAlertsChecked();
                            setIsChatOpen((prev) => !prev);
                        }}
                    >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        {t("nav.chat")}
                        {hasChatAlert && (
                            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500 ring-1 ring-[var(--header-bg)]" />
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "relative text-[var(--muted)] hover:text-[var(--fg)]",
                            isQnaFeedbackOpen && "text-[var(--primary)] bg-[var(--primary)]/10"
                        )}
                        onClick={() => {
                            trackNavAction("nav.qna_feedback");
                            setIsQnaFeedbackOpen((prev) => !prev);
                        }}
                    >
                        <CircleHelp className="w-4 h-4 mr-2" />
                        {t("workspace.qnaFeedback")}
                    </Button>

                    {isAdminUser && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "relative text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300",
                                pathname.startsWith("/admin") && "bg-emerald-500/10"
                            )}
                            onClick={() => {
                                trackNavAction("nav.admin_dashboard");
                                router.push("/admin/qna");
                            }}
                        >
                            {t("nav.adminDashboard")}
                        </Button>
                    )}

                    <div className="h-6 w-px bg-[var(--border)] mx-2" />

                    {/* Profile & Logout */}
                    {sessionStatus === "authenticated" ? (
                        <div className="flex items-center gap-3">
                            <Link
                                href="/profile"
                                onClick={() => trackNavAction("nav.my_profile")}
                                className="h-8 w-8 rounded-full bg-[var(--primary)]/15 flex items-center justify-center text-[var(--primary)] text-xs font-bold hover:ring-2 hover:ring-[var(--ring)]/40 transition-all"
                            >
                                {session?.user?.name?.[0] || <UserIcon className="w-4 h-4" />}
                            </Link>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-[var(--muted)] hover:text-red-500 w-8 h-8"
                                aria-label={t("nav.logout")}
                                onClick={() => {
                                    trackNavAction("nav.logout");
                                    void signOut({ callbackUrl: "/login" });
                                }}
                            >
                                <LogOut className="w-4 h-4" />
                            </Button>
                        </div>
                    ) : (
                        <Button
                            size="sm"
                            onClick={() => router.push("/login")}
                        >
                            {t("nav.signIn")}
                        </Button>
                    )}
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
                onClose={() => {
                    markChatAlertsChecked();
                    setIsChatOpen(false);
                }}
                openDmRequest={openChatDmRequest}
            />
            <QnaFeedbackWidget
                isOpen={isQnaFeedbackOpen}
                onClose={() => setIsQnaFeedbackOpen(false)}
                teamId={workspaceTeamId}
                authorName={String(session?.user?.name || session?.user?.email || currentUserId || "")}
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
