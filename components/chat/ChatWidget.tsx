"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { X, Send, Loader2, UserRound, Users as UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuditRealtime } from "@/lib/realtime/use-audit-realtime";

const STORAGE_KEY = "onbure.chatWidget.rect";

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function clampRange(v: number, minValue: number, maxValue: number) {
  const lo = Math.min(minValue, maxValue);
  const hi = Math.max(minValue, maxValue);
  return clamp(v, lo, hi);
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

interface Rect { x: number; y: number; width: number; height: number }

interface DmUserItem {
  id: string;
  userId: string;
  username: string;
  language?: string;
  skills?: string[];
}

interface TeamItem {
  id: string;
  teamId: string;
  name: string;
  visibility?: string;
}

interface ThreadItem {
  id: string;
  threadId: string;
  type: "dm" | "team";
  title: string;
  participantsUserIds: string[];
  teamId?: string;
}

interface MessageItem {
  id: string;
  messageId: string;
  threadId: string;
  senderId: string;
  senderUsername?: string;
  bodyOriginal: string;
  createdAt: string;
}

interface ThreadDirectoryItem {
  threadId: string;
  type: "DM" | "TEAM";
  participantsUserIds?: string[];
  dmSeenMap?: Record<string, number>;
  teamId?: string | null;
}

interface DmReadReceipt {
  threadId: string;
  available: boolean;
  otherUserId?: string;
  otherSeenAt?: number;
}

interface ProfileMenuState {
  x: number;
  y: number;
  targetType: "user" | "team";
  targetId: string;
}

interface OpenDmRequest {
  userId: string;
  username?: string;
  token: number;
}

function uniqueMessageKey(message: MessageItem) {
  return message.id || message.messageId || `${message.threadId}:${message.senderId}:${message.createdAt}:${message.bodyOriginal}`;
}

function dedupeMessages(messages: MessageItem[]) {
  const seen = new Set<string>();
  const unique: MessageItem[] = [];
  for (const message of messages) {
    const key = uniqueMessageKey(message);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(message);
  }
  return unique;
}

function previewText(value?: string) {
  const text = (value || "").trim();
  return text || "No messages yet.";
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
      if (threadId && epoch > 0) {
        normalized[threadId] = epoch;
      }
    }
    return normalized;
  } catch {
    return {};
  }
}

function writeSeenMap(storageKey: string, map: Record<string, number>) {
  if (typeof window === "undefined" || !storageKey) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(map));
  } catch {
    // noop
  }
}

function formatUnreadCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

export default function ChatWidget({
  isOpen,
  onClose,
  openDmRequest,
}: {
  isOpen: boolean;
  onClose: () => void;
  openDmRequest?: OpenDmRequest | null;
}) {
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

  return (
    <>
      <div
        ref={widgetRef}
        className="fixed z-50 flex flex-col border rounded-lg overflow-hidden shadow-lg"
        style={{
          left: `${rect.x}px`,
          top: `${rect.y}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          borderColor: "var(--border)",
          backgroundColor: "var(--card-bg)",
          cursor: isDragging ? "grabbing" : "default",
        }}
      >
        {["top", "bottom", "left", "right", "top-left", "top-right", "bottom-left", "bottom-right"].map((edge) => (
          <div
            key={edge}
            onMouseDown={(e) => handleResizeStart(e, edge)}
            className="absolute"
            style={{
              cursor:
                edge === "top" || edge === "bottom" ? "ns-resize" :
                  edge === "left" || edge === "right" ? "ew-resize" :
                    edge === "top-left" || edge === "bottom-right" ? "nwse-resize" :
                      "nesw-resize",
              ...(edge === "top" && { top: 0, left: RESIZE_HANDLE_SIZE, right: RESIZE_HANDLE_SIZE, height: RESIZE_HANDLE_SIZE }),
              ...(edge === "bottom" && { bottom: 0, left: RESIZE_HANDLE_SIZE, right: RESIZE_HANDLE_SIZE, height: RESIZE_HANDLE_SIZE }),
              ...(edge === "left" && { left: 0, top: RESIZE_HANDLE_SIZE, bottom: RESIZE_HANDLE_SIZE, width: RESIZE_HANDLE_SIZE }),
              ...(edge === "right" && { right: 0, top: RESIZE_HANDLE_SIZE, bottom: RESIZE_HANDLE_SIZE, width: RESIZE_HANDLE_SIZE }),
              ...(edge === "top-left" && { top: 0, left: 0, width: RESIZE_HANDLE_SIZE * 2, height: RESIZE_HANDLE_SIZE * 2 }),
              ...(edge === "top-right" && { top: 0, right: 0, width: RESIZE_HANDLE_SIZE * 2, height: RESIZE_HANDLE_SIZE * 2 }),
              ...(edge === "bottom-left" && { bottom: 0, left: 0, width: RESIZE_HANDLE_SIZE * 2, height: RESIZE_HANDLE_SIZE * 2 }),
              ...(edge === "bottom-right" && { bottom: 0, right: 0, width: RESIZE_HANDLE_SIZE * 2, height: RESIZE_HANDLE_SIZE * 2 }),
            }}
          />
        ))}

        <div
          className="flex items-center gap-3 px-4 flex-shrink-0 select-none"
          style={{ height: 46, background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          <div className="text-sm font-semibold">Chat</div>
          <div
            className="flex-1 h-full cursor-grab active:cursor-grabbing"
            onMouseDown={handleDragStart}
            aria-label="Drag chat window"
          />
          <button
            onClick={() => {
              saveRect(rect);
              onClose();
            }}
            className="text-[var(--primary-foreground)] hover:opacity-90"
            aria-label="Close chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          className="flex-1 min-h-0"
          style={{
            display: "grid",
            gridTemplateColumns: isCompact ? "1fr" : "220px 1fr",
            gridTemplateRows: isCompact ? "minmax(140px, 40%) minmax(240px, 60%)" : "1fr",
          }}
        >
          <aside className={cn("min-w-0 min-h-0 border-[var(--border)] flex flex-col", isCompact ? "border-b" : "border-r")}>
            <div className="p-2 border-b border-[var(--border)]">
              <div className="grid grid-cols-2 gap-1">
                <button
                  className={cn(
                    "h-8 rounded-md text-xs font-semibold transition-colors",
                    activeTab === "dm" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-[var(--card-bg-hover)] text-[var(--fg)]"
                  )}
                  onClick={() => setActiveTab("dm")}
                >
                  1:1
                </button>
                <button
                  className={cn(
                    "h-8 rounded-md text-xs font-semibold transition-colors",
                    activeTab === "team" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-[var(--card-bg-hover)] text-[var(--fg)]"
                  )}
                  onClick={() => setActiveTab("team")}
                >
                  Team
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-2 space-y-2">
              {(directoryLoading || threadLoading) && (
                <div className="h-full flex items-center justify-center text-[var(--muted)] text-sm">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Loading...
                </div>
              )}

              {!directoryLoading && !threadLoading && activeTab === "dm" && dmUsers.length === 0 && (
                <div className="text-xs text-[var(--muted)] p-2">No approved chat connections yet.</div>
              )}
              {!directoryLoading && !threadLoading && activeTab === "team" && teams.length === 0 && (
                <div className="text-xs text-[var(--muted)] p-2">No team found.</div>
              )}

              {!directoryLoading && !threadLoading && activeTab === "dm" && dmUsers.map((user) => {
                const unreadCount = dmUnreadCountByUserId[user.userId] || 0;
                return (
                  <button
                    key={user.userId}
                    onClick={() => void openDmThread(user)}
                    onContextMenu={(event) => openProfileMenu(event, "user", user.userId)}
                    className="w-full text-left p-2 rounded-md border border-[var(--border)] hover:bg-[var(--card-bg-hover)] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-[var(--card-bg-hover)] border border-[var(--border)] flex items-center justify-center">
                        <UserRound className="w-4 h-4 text-[var(--muted)]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--fg)] truncate">
                          {user.username}
                        </p>
                        <p className="text-[11px] text-[var(--muted)] truncate">
                          {dmLastMessageByUserId[user.userId] || "No messages yet."}
                        </p>
                      </div>
                      {unreadCount > 0 && (
                        <span className="shrink-0 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-none text-white">
                          {formatUnreadCount(unreadCount)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {!directoryLoading && !threadLoading && activeTab === "team" && teams.map((team) => {
                const unreadCount = teamUnreadCountByTeamId[team.teamId] || 0;
                return (
                  <button
                    key={team.teamId}
                    onClick={() => void openTeamThread(team)}
                    onContextMenu={(event) => openProfileMenu(event, "team", team.teamId)}
                    className="w-full text-left p-2 rounded-md border border-[var(--border)] hover:bg-[var(--card-bg-hover)] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-[var(--card-bg-hover)] border border-[var(--border)] flex items-center justify-center">
                        <UsersIcon className="w-4 h-4 text-[var(--muted)]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--fg)] truncate">{team.name}</p>
                        <p className="text-[11px] text-[var(--muted)] truncate">
                          {teamLastMessageByTeamId[team.teamId] || "No messages yet."}
                        </p>
                      </div>
                      {unreadCount > 0 && (
                        <span className="shrink-0 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-none text-white">
                          {formatUnreadCount(unreadCount)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="min-w-0 min-h-0 flex flex-col">
            <div className="h-10 border-b border-[var(--border)] px-3 flex items-center">
              {activeDmUserId ? (
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    onContextMenu={(event) => openProfileMenu(event, "user", activeDmUserId)}
                    className="h-6 w-6 rounded-full bg-[var(--card-bg-hover)] border border-[var(--border)] flex items-center justify-center cursor-context-menu shrink-0"
                  >
                    <UserRound className="w-3.5 h-3.5 text-[var(--muted)]" />
                  </div>
                  <div className="text-sm font-medium text-[var(--fg)] truncate">
                    {activeThreadLabel}
                  </div>
                </div>
              ) : activeTeamId ? (
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    onContextMenu={(event) => openProfileMenu(event, "team", activeTeamId)}
                    className="h-6 w-6 rounded-full bg-[var(--card-bg-hover)] border border-[var(--border)] flex items-center justify-center cursor-context-menu shrink-0"
                  >
                    <UsersIcon className="w-3.5 h-3.5 text-[var(--muted)]" />
                  </div>
                  <div className="text-sm font-medium text-[var(--fg)] truncate">
                    {activeThreadLabel}
                  </div>
                </div>
              ) : (
                <div className="text-sm font-medium text-[var(--fg)] truncate">{activeThreadLabel}</div>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-auto p-3 space-y-2">
              {messagesLoading && (
                <div className="h-full flex items-center justify-center text-[var(--muted)] text-sm">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Loading messages...
                </div>
              )}

              {!messagesLoading && !activeThread && (
                <div className="h-full flex items-center justify-center text-[var(--muted)] text-sm text-center px-4">
                  Select a profile on the left to open a chat thread.
                </div>
              )}

              {!messagesLoading && activeThread && messages.length === 0 && (
                <div className="h-full flex items-center justify-center text-[var(--muted)] text-sm text-center px-4">
                  No messages yet. Start the conversation.
                </div>
              )}

              {!messagesLoading && activeThread && messages.map((message) => {
                const senderId = (message.senderId || "").trim();
                const isMine = Boolean(currentUserId) && senderId === currentUserId;
                const showSenderName = activeThread.type === "team";
                const senderLabel = isMine ? "You" : (message.senderUsername || senderId || "Unknown");
                const messageKey = uniqueMessageKey(message);
                const showDmReadReceipt =
                  activeThread.type === "dm" &&
                  isMine &&
                  messageKey === lastMyDmMessageKey &&
                  Boolean(lastMyDmMessageKey) &&
                  Boolean(dmReadReceipt?.available);
                return (
                  <div key={uniqueMessageKey(message)} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                    <div className="max-w-[78%]">
                      <div
                        className={cn(
                          "rounded-xl px-3 py-2 text-sm border",
                          isMine
                            ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                            : "bg-[var(--card-bg)] text-[var(--fg)] border-[var(--border)]"
                        )}
                      >
                        {showSenderName && (
                          <p
                            className={cn(
                              "mb-1 text-[11px] font-semibold",
                              isMine ? "text-[var(--primary-foreground)]/85" : "text-[var(--muted)]"
                            )}
                          >
                            {senderLabel}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap break-words">{message.bodyOriginal}</p>
                      </div>
                      {showDmReadReceipt && (
                        <p className="mt-1 text-[10px] text-[var(--muted)] text-right pr-1">
                          {isLastMyDmMessageRead ? "읽음" : "안읽음"}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleSend} className="shrink-0 p-3 border-t border-[var(--border)]">
              <div className="flex gap-2">
                <input
                  ref={messageInputRef}
                  className="flex-1 px-3 py-2 border rounded-md text-sm bg-[var(--input-bg)] text-[var(--fg)]"
                  style={{ borderColor: "var(--border)" }}
                  placeholder={activeThread ? "Type a message..." : "Select a thread first"}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={!activeThread || sendLoading}
                />
                <Button size="sm" variant="primary" type="submit" disabled={!activeThread || !draft.trim() || sendLoading}>
                  {sendLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
              {errorText && <p className="text-xs text-red-500 mt-2">{errorText}</p>}
            </form>
          </section>
        </div>
      </div>
      {profileMenu && (
        <div
          data-chat-profile-menu="true"
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
            onClick={handleProfileMenuOpen}
          >
            {profileMenu.targetType === "team" ? "Team Profile" : "View Profile"}
          </button>
        </div>
      )}
    </>
  );
}
