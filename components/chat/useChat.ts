import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useAuditRealtime } from "@/lib/realtime/use-audit-realtime";
import { 
  Rect, DmUserItem, TeamItem, ThreadItem, MessageItem, ThreadDirectoryItem, DmReadReceipt, ProfileMenuState, OpenDmRequest 
} from "./types";
import { clamp, clampRange, toEpochMs, uniqueMessageKey, dedupeMessages, previewText, readSeenMap, writeSeenMap } from "./utils";

const STORAGE_KEY = "onbure.chatWidget.rect";

export function useChat({ isOpen, onClose, openDmRequest }: { isOpen: boolean; onClose: () => void; openDmRequest?: OpenDmRequest | null }) {

  const { data: session } = useSession();
  const router = useRouter();
  const currentUserId = (session?.user as { id?: string } | undefined)?.id || "";

  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, rectX: 0, rectY: 0 });
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [resizeBase, setResizeBase] = useState<Rect | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<"dm" | "team">("dm");
  const [dmUsers, setDmUsers] = useState<DmUserItem[]>([]);
  const [dmLastMessageByUserId, setDmLastMessageByUserId] = useState<Record<string, string>>({});
  const [dmUnreadCountByUserId, setDmUnreadCountByUserId] = useState<Record<string, number>>({});
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [teamLastMessageByTeamId, setTeamLastMessageByTeamId] = useState<Record<string, string>>({});
  const [teamUnreadCountByTeamId, setTeamUnreadCountByTeamId] = useState<Record<string, number>>({});
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [activeThread, setActiveThread] = useState<ThreadItem | null>(null);
  const [activeDmUserId, setActiveDmUserId] = useState<string | null>(null);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [activeThreadLabel, setActiveThreadLabel] = useState<string>("Choose a conversation");
  const [threadLoading, setThreadLoading] = useState(false);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [dmReadReceipt, setDmReadReceipt] = useState<DmReadReceipt | null>(null);
  const [profileMenu, setProfileMenu] = useState<ProfileMenuState | null>(null);
  const messageInputRef = useRef<HTMLInputElement | null>(null);
  const lastHandledOpenDmTokenRef = useRef<number | null>(null);
  const localDmSeenByThreadRef = useRef<Record<string, number>>({});
  const localTeamSeenByThreadRef = useRef<Record<string, number>>({});
  const lastRealtimeRefreshAtRef = useRef(0);

  const defaults = { width: 420, height: 600 };
  const min = { width: 320, height: 420 };
  const max = { width: 720, height: 900 };
  const EDGE_MARGIN = 24;
  const TOP_MARGIN = 80;
  const RESIZE_HANDLE_SIZE = 10;
  const isCompact = rect ? rect.width < 560 : true;
  const dmSeenStorageKey = currentUserId ? `onbure.chatWidget.dmSeenMap.${currentUserId}` : "";
  const teamSeenStorageKey = currentUserId ? `onbure.chatWidget.teamSeenMap.${currentUserId}` : "";
  const isPageVisible = () => (typeof document === "undefined" ? true : document.visibilityState === "visible");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Rect;
        setRect(parsed);
        return;
      }
    } catch (e) {
      console.error("Failed to read chat widget rect", e);
    }

    const w = defaults.width;
    const h = defaults.height;
    const x = typeof window !== "undefined" ? window.innerWidth - w - EDGE_MARGIN : 0;
    const y = typeof window !== "undefined" ? window.innerHeight - h - EDGE_MARGIN : 0;
    setRect({ x, y, width: w, height: h });
  }, [mounted, defaults.width, defaults.height, EDGE_MARGIN]);

  useEffect(() => {
    if (!mounted || !dmSeenStorageKey) return;
    localDmSeenByThreadRef.current = readSeenMap(dmSeenStorageKey);
  }, [mounted, dmSeenStorageKey]);

  useEffect(() => {
    if (!mounted || !teamSeenStorageKey) return;
    localTeamSeenByThreadRef.current = readSeenMap(teamSeenStorageKey);
  }, [mounted, teamSeenStorageKey]);

  const saveRect = useCallback((r: Rect) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
    } catch (e) {
      console.error("Failed to persist chat rect", e);
    }
  }, []);

  const fetchDmReadReceipt = useCallback(async (threadId: string) => {
    if (!threadId) {
      setDmReadReceipt(null);
      return null;
    }
    try {
      const res = await fetch(`/api/chat/read-receipt?threadId=${encodeURIComponent(threadId)}`);
      if (!res.ok) return null;
      const payload = (await res.json()) as DmReadReceipt;
      setDmReadReceipt(payload);
      return payload;
    } catch {
      return null;
    }
  }, []);

  const markCurrentUserSeen = useCallback(async (threadId: string, seenAt?: string | number | Date | null) => {
    if (!threadId) {
      setDmReadReceipt(null);
      return null;
    }
    const seenAtEpoch = toEpochMs(seenAt) || Date.now();
    const nextLocalSeen = {
      ...localDmSeenByThreadRef.current,
      [threadId]: seenAtEpoch,
    };
    localDmSeenByThreadRef.current = nextLocalSeen;
    if (dmSeenStorageKey) {
      writeSeenMap(dmSeenStorageKey, nextLocalSeen);
    }
    window.dispatchEvent(new Event("onbure-chat-alert-refresh"));

    try {
      const res = await fetch("/api/chat/read-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, seenAt: seenAtEpoch }),
      });
      if (!res.ok) return null;
      const payload = (await res.json()) as DmReadReceipt;
      setDmReadReceipt(payload);
      window.dispatchEvent(new Event("onbure-chat-alert-refresh"));
      return payload;
    } catch {
      return null;
    }
  }, [dmSeenStorageKey]);

  const markTeamThreadSeen = useCallback((threadId: string, seenAt?: string | number | Date | null) => {
    if (!threadId || !teamSeenStorageKey) return 0;
    const seenAtEpoch = toEpochMs(seenAt) || Date.now();
    const next = {
      ...localTeamSeenByThreadRef.current,
      [threadId]: seenAtEpoch,
    };
    localTeamSeenByThreadRef.current = next;
    writeSeenMap(teamSeenStorageKey, next);
    window.dispatchEvent(new Event("onbure-chat-alert-refresh"));
    return seenAtEpoch;
  }, [teamSeenStorageKey]);

  const clampDraggedRect = useCallback((r: Rect) => {
    const winW = typeof window !== "undefined" ? window.innerWidth : 1024;
    const winH = typeof window !== "undefined" ? window.innerHeight : 768;
    const maxHeight = Math.floor(winH * 0.7);
    const w = clamp(r.width, min.width, max.width);
    const h = clamp(r.height, min.height, Math.min(max.height, maxHeight));
    const minX = EDGE_MARGIN - w;
    const maxX = winW - EDGE_MARGIN;
    const minY = TOP_MARGIN;
    const maxY = winH - EDGE_MARGIN;
    const x = clamp(r.x, minX, maxX);
    const y = clamp(r.y, minY, maxY);
    return { x, y, width: w, height: h };
  }, [min.width, min.height, max.width, max.height, EDGE_MARGIN, TOP_MARGIN]);

  const clampResizedRect = useCallback((base: Rect, edge: string, deltaX: number, deltaY: number) => {
    const winW = typeof window !== "undefined" ? window.innerWidth : 1024;
    const winH = typeof window !== "undefined" ? window.innerHeight : 768;
    const maxHeightByViewport = Math.floor(winH * 0.7);
    const allowedMaxHeight = Math.min(max.height, maxHeightByViewport);

    const hasLeft = edge.includes("left");
    const hasRight = edge.includes("right");
    const hasTop = edge.includes("top");
    const hasBottom = edge.includes("bottom");

    let width = base.width;
    let height = base.height;
    let x = base.x;
    let y = base.y;

    const rightAnchor = base.x + base.width;
    const bottomAnchor = base.y + base.height;

    if (hasLeft || hasRight) {
      width = hasLeft ? base.width - deltaX : base.width + deltaX;

      if (hasLeft) {
        const minWidthByVisibility = Math.max(min.width, rightAnchor - (winW - EDGE_MARGIN));
        width = clampRange(width, minWidthByVisibility, max.width);
        x = rightAnchor - width;
      } else {
        const minWidthByVisibility = Math.max(min.width, EDGE_MARGIN - base.x);
        width = clampRange(width, minWidthByVisibility, max.width);
        x = base.x;
      }
    }

    if (hasTop || hasBottom) {
      height = hasTop ? base.height - deltaY : base.height + deltaY;

      if (hasTop) {
        const minHeightByBottomVisibility = Math.max(min.height, bottomAnchor - (winH - EDGE_MARGIN));
        const maxHeightByTopMargin = Math.min(allowedMaxHeight, bottomAnchor - TOP_MARGIN);
        height = clampRange(height, minHeightByBottomVisibility, maxHeightByTopMargin);
        y = bottomAnchor - height;
      } else {
        const minHeightByVisibility = Math.max(min.height, EDGE_MARGIN - base.y);
        height = clampRange(height, minHeightByVisibility, allowedMaxHeight);
        y = base.y;
      }
    }

    if (!hasLeft && !hasRight) {
      const minX = EDGE_MARGIN - width;
      const maxX = winW - EDGE_MARGIN;
      x = clamp(x, minX, maxX);
    }

    if (!hasTop && !hasBottom) {
      const minY = TOP_MARGIN;
      const maxY = winH - EDGE_MARGIN;
      y = clamp(y, minY, maxY);
    }

    if (y < TOP_MARGIN) {
      y = TOP_MARGIN;
      if (hasTop) {
        height = clampRange(bottomAnchor - y, min.height, allowedMaxHeight);
      }
    }

    const minX = EDGE_MARGIN - width;
    const maxX = winW - EDGE_MARGIN;
    const maxY = winH - EDGE_MARGIN;
    x = clamp(x, minX, maxX);
    y = clamp(y, TOP_MARGIN, maxY);

    return { x, y, width, height };
  }, [min.width, min.height, max.width, max.height, EDGE_MARGIN, TOP_MARGIN]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (profileMenu) {
          setProfileMenu(null);
          return;
        }
        onClose();
      }
    }
    if (isOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, profileMenu]);

  useEffect(() => {
    if (!profileMenu) return;
    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-chat-profile-menu='true']")) return;
      setProfileMenu(null);
    }
    function closeOnResize() {
      setProfileMenu(null);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("resize", closeOnResize);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("resize", closeOnResize);
    };
  }, [profileMenu]);

  const handleDragStart = (e: React.MouseEvent) => {
    if (!rect) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY, rectX: rect.x, rectY: rect.y });
  };

  const handleResizeStart = (e: React.MouseEvent, edge: string) => {
    e.preventDefault();
    setIsResizing(edge);
    setDragStart({ x: e.clientX, y: e.clientY, rectX: rect?.x || 0, rectY: rect?.y || 0 });
    if (rect) {
      setResizeBase(rect);
    }
  };

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!rect) return;

      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;

      if (isDragging) {
        const next = { ...rect, x: dragStart.rectX + deltaX, y: dragStart.rectY + deltaY };
        const cl = clampDraggedRect(next);
        setRect(cl);
        return;
      }

      if (isResizing && resizeBase) {
        setRect(clampResizedRect(resizeBase, isResizing, deltaX, deltaY));
      }
    };

    const handleMouseUp = () => {
      if ((isDragging || isResizing) && rect) {
        saveRect(rect);
      }
      setIsDragging(false);
      setIsResizing(null);
      setResizeBase(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, rect, resizeBase, saveRect, clampDraggedRect, clampResizedRect]);

  const fetchMessages = useCallback(async (threadId: string, showLoader = true) => {
    if (showLoader) setMessagesLoading(true);
    try {
      const res = await fetch(`/api/chat/messages?threadId=${encodeURIComponent(threadId)}`);
      if (!res.ok) throw new Error("Failed to load messages");
      const data = (await res.json()) as MessageItem[];
      const deduped = dedupeMessages(data);
      setMessages(deduped);
      return deduped;
    } catch (error) {
      console.error(error);
      setErrorText("Failed to load messages.");
      return [] as MessageItem[];
    } finally {
      if (showLoader) setMessagesLoading(false);
    }
  }, []);

  const fetchDmLastMessagePreview = useCallback(async (users: DmUserItem[]) => {
    if (!users.length || !currentUserId) {
      setDmLastMessageByUserId({});
      setDmUnreadCountByUserId({});
      return;
    }

    try {
      const nextPreview: Record<string, string> = {};
      const nextUnreadCount: Record<string, number> = {};
      await Promise.all(
        users.map(async (user) => {
          try {
            const threadRes = await fetch("/api/chat/thread/dm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ otherUserId: user.userId }),
            });

            if (!threadRes.ok) {
              nextPreview[user.userId] = "No messages yet.";
              nextUnreadCount[user.userId] = 0;
              return;
            }

            const thread = (await threadRes.json()) as ThreadDirectoryItem;
            if (!thread?.threadId) {
              nextPreview[user.userId] = "No messages yet.";
              nextUnreadCount[user.userId] = 0;
              return;
            }

            const messagesRes = await fetch(`/api/chat/messages?threadId=${encodeURIComponent(thread.threadId)}`);
            if (!messagesRes.ok) {
              nextPreview[user.userId] = "No messages yet.";
              nextUnreadCount[user.userId] = 0;
              return;
            }

            const threadMessages = (await messagesRes.json()) as MessageItem[];
            const latest = threadMessages[threadMessages.length - 1];
            nextPreview[user.userId] = previewText(latest?.bodyOriginal);

            const serverSeenAt = Number(thread.dmSeenMap?.[currentUserId] || 0);
            const localSeenAt = Number(localDmSeenByThreadRef.current[thread.threadId] || 0);
            const currentSeenAt = Math.max(serverSeenAt, localSeenAt);
            const isActiveDm = activeThread?.type === "dm" && activeDmUserId === user.userId;
            const unreadCount = threadMessages.reduce((count, message) => {
              const createdAtEpoch = toEpochMs(message.createdAt);
              const senderId = (message.senderId || "").trim();
              const isFromOther = Boolean(senderId) && senderId !== currentUserId;
              const isUnread = createdAtEpoch > currentSeenAt;
              return isFromOther && isUnread ? count + 1 : count;
            }, 0);
            nextUnreadCount[user.userId] = isActiveDm ? 0 : unreadCount;
          } catch {
            nextPreview[user.userId] = "No messages yet.";
            nextUnreadCount[user.userId] = 0;
          }
        })
      );

      setDmLastMessageByUserId(nextPreview);
      setDmUnreadCountByUserId(nextUnreadCount);
    } catch (error) {
      console.error(error);
      const fallback: Record<string, string> = {};
      const fallbackUnread: Record<string, number> = {};
      for (const user of users) {
        fallback[user.userId] = "No messages yet.";
        fallbackUnread[user.userId] = 0;
      }
      setDmLastMessageByUserId(fallback);
      setDmUnreadCountByUserId(fallbackUnread);
    }
  }, [currentUserId, activeThread, activeDmUserId]);

  const fetchTeamLastMessagePreview = useCallback(async (teamItems: TeamItem[]) => {
    if (!teamItems.length || !currentUserId) {
      setTeamLastMessageByTeamId({});
      setTeamUnreadCountByTeamId({});
      return;
    }

    try {
      const nextPreview: Record<string, string> = {};
      const nextUnreadCount: Record<string, number> = {};

      await Promise.all(
        teamItems.map(async (team) => {
          try {
            const threadRes = await fetch("/api/chat/thread/team", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ teamId: team.teamId }),
            });

            if (!threadRes.ok) {
              nextPreview[team.teamId] = "No messages yet.";
              nextUnreadCount[team.teamId] = 0;
              return;
            }

            const thread = (await threadRes.json()) as ThreadItem;
            if (!thread?.threadId) {
              nextPreview[team.teamId] = "No messages yet.";
              nextUnreadCount[team.teamId] = 0;
              return;
            }

            const messagesRes = await fetch(`/api/chat/messages?threadId=${encodeURIComponent(thread.threadId)}`);
            if (!messagesRes.ok) {
              nextPreview[team.teamId] = "No messages yet.";
              nextUnreadCount[team.teamId] = 0;
              return;
            }

            const teamMessages = (await messagesRes.json()) as MessageItem[];
            const latest = teamMessages[teamMessages.length - 1];
            nextPreview[team.teamId] = previewText(latest?.bodyOriginal);

            const isActiveTeam = activeThread?.type === "team" && activeTeamId === team.teamId;
            const localSeenAt = Number(localTeamSeenByThreadRef.current[thread.threadId] || 0);
            const baseSeenAt = isActiveTeam
              ? markTeamThreadSeen(thread.threadId, latest?.createdAt || Date.now())
              : localSeenAt;

            const unreadCount = teamMessages.reduce((count, message) => {
              const createdAtEpoch = toEpochMs(message.createdAt);
              const senderId = (message.senderId || "").trim();
              const isFromOther = Boolean(senderId) && senderId !== currentUserId;
              const isUnread = createdAtEpoch > baseSeenAt;
              return isFromOther && isUnread ? count + 1 : count;
            }, 0);

            nextUnreadCount[team.teamId] = isActiveTeam ? 0 : unreadCount;
          } catch {
            nextPreview[team.teamId] = "No messages yet.";
            nextUnreadCount[team.teamId] = 0;
          }
        })
      );

      setTeamLastMessageByTeamId(nextPreview);
      setTeamUnreadCountByTeamId(nextUnreadCount);
    } catch (error) {
      console.error(error);
      const fallbackPreview: Record<string, string> = {};
      const fallbackUnread: Record<string, number> = {};
      for (const team of teamItems) {
        fallbackPreview[team.teamId] = "No messages yet.";
        fallbackUnread[team.teamId] = 0;
      }
      setTeamLastMessageByTeamId(fallbackPreview);
      setTeamUnreadCountByTeamId(fallbackUnread);
    }
  }, [currentUserId, activeThread, activeTeamId, markTeamThreadSeen]);

  const fetchDirectory = useCallback(async () => {
    setDirectoryLoading(true);
    setErrorText("");
    try {
      const [usersRes, teamsRes] = await Promise.all([
        fetch("/api/chat/dm-users"),
        fetch("/api/chat/teams"),
      ]);

      let hasAnySuccess = false;

      if (usersRes.ok) {
        const usersData = (await usersRes.json()) as DmUserItem[];
        setDmUsers(usersData);
        hasAnySuccess = true;
      }

      if (teamsRes.ok) {
        const teamsData = (await teamsRes.json()) as TeamItem[];
        setTeams(teamsData);
        hasAnySuccess = true;
      }

      if (!hasAnySuccess) {
        throw new Error("Failed to load chat directory");
      }

      if (!usersRes.ok || !teamsRes.ok) {
        setErrorText("Some chat data is temporarily unavailable.");
      }
    } catch (error) {
      console.error(error);
      setErrorText("Failed to load chat users/teams.");
    } finally {
      setDirectoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    if (activeTab === "dm") {
      if (!dmUsers.length) {
        setDmLastMessageByUserId({});
        setDmUnreadCountByUserId({});
        return;
      }
      void fetchDmLastMessagePreview(dmUsers);
      return;
    }

    if (!teams.length) {
      setTeamLastMessageByTeamId({});
      setTeamUnreadCountByTeamId({});
      return;
    }
    void fetchTeamLastMessagePreview(teams);
  }, [isOpen, activeTab, dmUsers, teams, fetchDmLastMessagePreview, fetchTeamLastMessagePreview]);

  const refreshActiveThread = useCallback(async () => {
    if (!activeThread) return;
    const loadedMessages = await fetchMessages(activeThread.threadId, false);
    if (activeThread.type === "dm" && activeDmUserId) {
      const latest = loadedMessages[loadedMessages.length - 1];
      await markCurrentUserSeen(activeThread.threadId, latest?.createdAt || Date.now());
      setDmLastMessageByUserId((prev) => ({
        ...prev,
        [activeDmUserId]: previewText(latest?.bodyOriginal),
      }));
      setDmUnreadCountByUserId((prev) => ({
        ...prev,
        [activeDmUserId]: 0,
      }));
      return;
    }

    if (activeThread.type === "team" && activeTeamId) {
      const latest = loadedMessages[loadedMessages.length - 1];
      markTeamThreadSeen(activeThread.threadId, latest?.createdAt || Date.now());
      setTeamLastMessageByTeamId((prev) => ({
        ...prev,
        [activeTeamId]: previewText(latest?.bodyOriginal),
      }));
      setTeamUnreadCountByTeamId((prev) => ({
        ...prev,
        [activeTeamId]: 0,
      }));
      return;
    }

    setDmReadReceipt(null);
  }, [activeThread, activeDmUserId, activeTeamId, fetchMessages, markCurrentUserSeen, markTeamThreadSeen]);

  useEffect(() => {
    if (!isOpen) return;
    void fetchDirectory();
  }, [isOpen, fetchDirectory]);

  useEffect(() => {
    if (isOpen) return;
    setActiveThread(null);
    setActiveDmUserId(null);
    setActiveTeamId(null);
    setActiveThreadLabel("Choose a conversation");
    setMessages([]);
    setDraft("");
    setErrorText("");
    setDmReadReceipt(null);
    setProfileMenu(null);
  }, [isOpen]);

  useEffect(() => {
    function onConnectionsUpdated() {
      if (!isOpen) return;
      void fetchDirectory();
    }
    window.addEventListener("onbure-chat-connections-updated", onConnectionsUpdated);
    return () => window.removeEventListener("onbure-chat-connections-updated", onConnectionsUpdated);
  }, [isOpen, fetchDirectory]);

  useAuditRealtime(isOpen && Boolean(currentUserId), (row) => {
    if (!isOpen || !isPageVisible()) return;

    const category = String(row.category || "").toLowerCase();
    if (category !== "chat" && category !== "request" && category !== "team") return;

    const actorUserId = String(row.actor_user_id || "").trim();
    const targetUserId = String(row.target_user_id || "").trim();
    const rowTeamId = String(row.team_id || "").trim();
    const isDirectEvent = actorUserId === currentUserId || targetUserId === currentUserId;
    const isMyTeamEvent = rowTeamId.length > 0 && teams.some((team) => team.teamId === rowTeamId);
    if (!isDirectEvent && !isMyTeamEvent) return;

    const now = Date.now();
    if (now - lastRealtimeRefreshAtRef.current < 1200) return;
    lastRealtimeRefreshAtRef.current = now;

    const metadata = (row.metadata || {}) as Record<string, unknown>;
    const metadataThreadId = String(metadata.threadId || "").trim();
    if (activeThread?.threadId && metadataThreadId && activeThread.threadId === metadataThreadId) {
      void refreshActiveThread();
      return;
    }

    void fetchDirectory();
    if (activeThread) {
      void refreshActiveThread();
    }
  });

  useEffect(() => {
    if (!isOpen) return;

    const refreshVisibleData = () => {
      if (!isPageVisible()) return;
      void fetchDirectory();
      if (activeThread) {
        void refreshActiveThread();
      }
    };

    const onFocus = () => refreshVisibleData();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshVisibleData();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isOpen, fetchDirectory, activeThread, refreshActiveThread]);

  useEffect(() => {
    if (!isOpen || !activeThread) return;
    const id = window.requestAnimationFrame(() => {
      messageInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [isOpen, activeThread]);

  const openDmThreadByUserId = useCallback(async (userId: string, fallbackLabel?: string) => {
    if (!userId) return;
    setThreadLoading(true);
    setErrorText("");
    try {
      const res = await fetch("/api/chat/thread/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherUserId: userId }),
      });
      if (!res.ok) throw new Error("Failed to open DM thread");
      const thread = (await res.json()) as ThreadItem;
      const matchedUser = dmUsers.find((item) => item.userId === userId);
      setActiveThread(thread);
      setActiveDmUserId(userId);
      setActiveTeamId(null);
      setActiveTab("dm");
      setActiveThreadLabel(matchedUser?.username || fallbackLabel || "Chat");
      const loadedMessages = await fetchMessages(thread.threadId);
      const latest = loadedMessages[loadedMessages.length - 1];
      await markCurrentUserSeen(thread.threadId, latest?.createdAt || Date.now());
      setDmLastMessageByUserId((prev) => ({
        ...prev,
        [userId]: previewText(latest?.bodyOriginal),
      }));
      setDmUnreadCountByUserId((prev) => ({
        ...prev,
        [userId]: 0,
      }));
    } catch (error) {
      console.error(error);
      setErrorText("Failed to open DM thread.");
    } finally {
      setThreadLoading(false);
    }
  }, [dmUsers, fetchMessages, markCurrentUserSeen]);

  const openDmThread = async (user: DmUserItem) => {
    await openDmThreadByUserId(user.userId, user.username);
  };

  const openTeamThread = async (team: TeamItem) => {
    setThreadLoading(true);
    setErrorText("");
    try {
      const res = await fetch("/api/chat/thread/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: team.teamId }),
      });
      if (!res.ok) throw new Error("Failed to open team thread");
      const thread = (await res.json()) as ThreadItem;
      setActiveThread(thread);
      setActiveDmUserId(null);
      setActiveTeamId(team.teamId);
      setActiveThreadLabel(team.name);
      setDmReadReceipt(null);
      const loadedMessages = await fetchMessages(thread.threadId);
      const latest = loadedMessages[loadedMessages.length - 1];
      markTeamThreadSeen(thread.threadId, latest?.createdAt || Date.now());
      setTeamLastMessageByTeamId((prev) => ({
        ...prev,
        [team.teamId]: previewText(latest?.bodyOriginal),
      }));
      setTeamUnreadCountByTeamId((prev) => ({
        ...prev,
        [team.teamId]: 0,
      }));
    } catch (error) {
      console.error(error);
      setErrorText("Failed to open team thread.");
    } finally {
      setThreadLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !openDmRequest?.userId) return;
    if (lastHandledOpenDmTokenRef.current === openDmRequest.token) return;

    lastHandledOpenDmTokenRef.current = openDmRequest.token;
    void openDmThreadByUserId(openDmRequest.userId, openDmRequest.username);
  }, [isOpen, openDmRequest, openDmThreadByUserId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThread || !draft.trim()) return;
    setSendLoading(true);
    setErrorText("");

    const body = draft.trim();
    setDraft("");
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: activeThread.threadId,
          body_original: body,
        }),
      });

      if (!res.ok) throw new Error("Failed to send message");
      const created = (await res.json()) as MessageItem;
      setMessages((prev) => dedupeMessages([...prev, created]));
      if (activeThread.type === "dm" && activeDmUserId) {
        setDmLastMessageByUserId((prev) => ({
          ...prev,
          [activeDmUserId]: previewText(created.bodyOriginal),
        }));
        setDmUnreadCountByUserId((prev) => ({
          ...prev,
          [activeDmUserId]: 0,
        }));
        void fetchDmReadReceipt(activeThread.threadId);
      } else if (activeThread.type === "team" && activeTeamId) {
        markTeamThreadSeen(activeThread.threadId, created.createdAt || Date.now());
        setTeamLastMessageByTeamId((prev) => ({
          ...prev,
          [activeTeamId]: previewText(created.bodyOriginal),
        }));
        setTeamUnreadCountByTeamId((prev) => ({
          ...prev,
          [activeTeamId]: 0,
        }));
      }
    } catch (error) {
      console.error(error);
      setErrorText("Failed to send message.");
      setDraft(body);
    } finally {
      setSendLoading(false);
      window.requestAnimationFrame(() => {
        messageInputRef.current?.focus();
      });
    }
  };

  if (!mounted || !rect) return null;
  if (!isOpen) return null;

  const openUserProfile = (userId: string) => {
    if (!userId) return;
    if (userId === currentUserId) {
      router.push("/profile");
      return;
    }
    router.push(`/people/${encodeURIComponent(userId)}`);
  };

  const openTeamProfile = (teamId: string) => {
    if (!teamId) return;
    router.push(`/teams/${encodeURIComponent(teamId)}`);
  };

  const openProfileMenu = (event: React.MouseEvent, targetType: "user" | "team", targetId: string) => {
    if (!targetId) return;
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 132;
    const menuHeight = 44;
    const edgeGap = 8;
    const x = clamp(event.clientX, edgeGap, window.innerWidth - menuWidth - edgeGap);
    const y = clamp(event.clientY, edgeGap, window.innerHeight - menuHeight - edgeGap);
    setProfileMenu({ x, y, targetType, targetId });
  };

  const handleProfileMenuOpen = () => {
    if (!profileMenu) return;
    if (profileMenu.targetType === "team") {
      openTeamProfile(profileMenu.targetId);
      setProfileMenu(null);
      return;
    }
    openUserProfile(profileMenu.targetId);
    setProfileMenu(null);
  };

  const lastMyDmMessage =
    activeThread?.type === "dm"
      ? [...messages].reverse().find((message) => (message.senderId || "").trim() === currentUserId)
      : null;
  const lastMyDmMessageKey = lastMyDmMessage ? uniqueMessageKey(lastMyDmMessage) : "";
  const lastMyDmMessageAt = toEpochMs(lastMyDmMessage?.createdAt);
  const otherSeenAt = Number(dmReadReceipt?.otherSeenAt || 0);
  const READ_TIME_GRACE_MS = 2000;
  const hasOtherReplyAfterMyLastMessage =
    activeThread?.type === "dm" &&
    lastMyDmMessageAt > 0 &&
    messages.some((message) => {
      const senderId = (message.senderId || "").trim();
      if (!senderId || senderId === currentUserId) return false;
      return toEpochMs(message.createdAt) >= lastMyDmMessageAt;
    });
  const isLastMyDmMessageRead =
    lastMyDmMessageAt > 0 &&
    (otherSeenAt + READ_TIME_GRACE_MS >= lastMyDmMessageAt || hasOtherReplyAfterMyLastMessage);
    return { session, router, currentUserId, mounted, setMounted, rect, setRect, isDragging, setIsDragging, dragStart, setDragStart, isResizing, setIsResizing, resizeBase, setResizeBase, widgetRef, activeTab, setActiveTab, dmUsers, setDmUsers, dmLastMessageByUserId, setDmLastMessageByUserId, dmUnreadCountByUserId, setDmUnreadCountByUserId, teams, setTeams, teamLastMessageByTeamId, setTeamLastMessageByTeamId, teamUnreadCountByTeamId, setTeamUnreadCountByTeamId, directoryLoading, setDirectoryLoading, activeThread, setActiveThread, activeDmUserId, setActiveDmUserId, activeTeamId, setActiveTeamId, activeThreadLabel, setActiveThreadLabel, threadLoading, setThreadLoading, messages, setMessages, messagesLoading, setMessagesLoading, draft, setDraft, sendLoading, setSendLoading, errorText, setErrorText, dmReadReceipt, setDmReadReceipt, profileMenu, setProfileMenu, messageInputRef, lastHandledOpenDmTokenRef, localDmSeenByThreadRef, localTeamSeenByThreadRef, lastRealtimeRefreshAtRef, defaults, min, max, EDGE_MARGIN, TOP_MARGIN, RESIZE_HANDLE_SIZE, isCompact, dmSeenStorageKey, teamSeenStorageKey, isPageVisible, saveRect, fetchDmReadReceipt, markCurrentUserSeen, markTeamThreadSeen, clampDraggedRect, clampResizedRect, handleDragStart, handleResizeStart, fetchMessages, fetchDmLastMessagePreview, fetchTeamLastMessagePreview, fetchDirectory, refreshActiveThread, openDmThreadByUserId, openDmThread, openTeamThread, handleSend, openUserProfile, openTeamProfile, openProfileMenu, handleProfileMenuOpen, lastMyDmMessage, lastMyDmMessageKey, lastMyDmMessageAt, otherSeenAt, READ_TIME_GRACE_MS, hasOtherReplyAfterMyLastMessage, isLastMyDmMessageRead };
}
