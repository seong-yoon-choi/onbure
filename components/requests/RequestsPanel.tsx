"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertModal } from "@/components/ui/modal";
import { Check, X, ListFilter, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { useAuditRealtime } from "@/lib/realtime/use-audit-realtime";

type RequestType = "CHAT" | "INVITE" | "JOIN" | "FILE";
type RequestStatus = "PENDING" | "ACCEPTED" | "DECLINED";
type TypeFilter = "" | RequestType;

interface RequestItem {
    id: string;
    requestId: string;
    type: RequestType;
    fromId: string;
    toId: string;
    teamId?: string;
    fileId?: string;
    fileName?: string;
    fileUrl?: string;
    status: RequestStatus;
    message?: string;
    answers?: { a1: string; a2: string };
    createdAt: string;
}

interface RequestPayload {
    requests: RequestItem[];
    history: RequestItem[];
}

interface RequestsPanelProps {
    showTitle?: boolean;
}

function sortLatestFirst(items: RequestItem[]) {
    return [...items].sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
    });
}

function statusStyle(status: RequestStatus) {
    if (status === "ACCEPTED") return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
    if (status === "DECLINED") return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20";
    return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
}

function typeLabel(type: RequestType) {
    if (type === "CHAT") return "Chat Request";
    if (type === "INVITE") return "Team Invite";
    if (type === "FILE") return "File Share";
    return "Application";
}

function requestBodyText(req: RequestItem) {
    if (req.type === "FILE") {
        const fileName = String(req.fileName || "").trim();
        const message = String(req.message || "").trim();
        if (fileName && message) return `${fileName} | ${message}`;
        if (fileName) return fileName;
    }

    const message = (req.message || "").trim();
    if (message) return message;

    if (req.type === "JOIN") {
        const joined = `${req.answers?.a1 || ""} ${req.answers?.a2 || ""}`.trim();
        if (joined) return joined;
    }

    const parts = [
        req.fromId ? `from: ${req.fromId}` : "",
        req.toId ? `to: ${req.toId}` : "",
        req.teamId ? `team: ${req.teamId}` : "",
        req.fileName ? `file: ${req.fileName}` : "",
    ].filter(Boolean);

    return parts.join(" | ") || "No message";
}

function parseFileNameFromDisposition(disposition: string | null) {
    const source = String(disposition || "");
    if (!source) return "";

    const utf8Match = source.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
        try {
            return decodeURIComponent(utf8Match[1]);
        } catch {
            return utf8Match[1];
        }
    }

    const asciiMatch = source.match(/filename=\"?([^\";]+)\"?/i);
    return asciiMatch?.[1] || "";
}

export default function RequestsPanel({ showTitle = true }: RequestsPanelProps) {
    const { data: session, status: sessionStatus } = useSession();
    const currentUserId = String((session?.user as { id?: string } | undefined)?.id || "").trim();
    const [filter, setFilter] = useState<TypeFilter>("");
    const [data, setData] = useState<RequestPayload>({ requests: [], history: [] });
    const [loading, setLoading] = useState(true);
    const [actingId, setActingId] = useState<string | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [notice, setNotice] = useState<{ open: boolean; title: string; message: string }>({
        open: false,
        title: "",
        message: "",
    });

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        const res = await fetch("/api/requests");
        if (res.ok) {
            const payload = (await res.json()) as RequestPayload;
            setData({
                requests: sortLatestFirst(payload.requests || []),
                history: sortLatestFirst(payload.history || []),
            });
            if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("onbure-requests-updated"));
            }
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        void fetchRequests();
    }, [fetchRequests]);

    useAuditRealtime(sessionStatus === "authenticated" && Boolean(currentUserId), (row) => {
        if (String(row.category || "").toLowerCase() !== "request") return;
        const actorUserId = String(row.actor_user_id || "").trim();
        const targetUserId = String(row.target_user_id || "").trim();
        if (actorUserId !== currentUserId && targetUserId !== currentUserId) return;
        if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
        void fetchRequests();
    });

    const visibleItems = useMemo(() => {
        const merged = [...data.requests, ...data.history];
        const filtered = filter ? merged.filter((item) => item.type === filter) : merged;
        return sortLatestFirst(filtered);
    }, [filter, data]);

    const handleAction = async (
        item: RequestItem,
        status: "ACCEPTED" | "DECLINED",
    ) => {
        if (actingId) return;
        setActingId(item.id);
        try {
            const targetUserId = item.type === "JOIN" ? item.fromId : item.toId;
            const res = await fetch("/api/requests", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: item.type,
                    id: item.id,
                    status,
                    teamId: item.teamId,
                    userId: targetUserId,
                }),
            });

            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                setNotice({
                    open: true,
                    title: "Request update failed",
                    message: payload.error || "Failed to update request.",
                });
                return;
            }

            await fetchRequests();

            if (item.type === "CHAT" && status === "ACCEPTED" && typeof window !== "undefined") {
                window.dispatchEvent(new Event("onbure-chat-connections-updated"));
            }
        } finally {
            setActingId(null);
        }
    };

    const handleDownload = async (item: RequestItem) => {
        if (downloadingId) return;
        setDownloadingId(item.id);
        try {
            const requestId = String(item.requestId || item.id || "").trim();
            if (!requestId) {
                throw new Error("Invalid file request.");
            }
            const res = await fetch(`/api/requests/file-download?requestId=${encodeURIComponent(requestId)}`);
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(String(payload?.error || "Failed to download file."));
            }

            const blob = await res.blob();
            const disposition = res.headers.get("Content-Disposition");
            const parsedName = parseFileNameFromDisposition(disposition);
            const fallbackName = String(item.fileName || "shared-file").trim() || "shared-file";
            const fileName = parsedName || fallbackName;
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = fileName;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            setNotice({
                open: true,
                title: "Download failed",
                message: error instanceof Error ? error.message : "Failed to download file.",
            });
        } finally {
            setDownloadingId(null);
        }
    };

    return (
        <div className="space-y-6">
            {showTitle && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h1 className="text-2xl font-bold text-[var(--fg)]">Requests</h1>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <ListFilter className="w-4 h-4 text-[var(--muted)] absolute left-2 top-2.5" />
                            <select
                                value={filter}
                                onChange={(e) => setFilter((e.target.value as TypeFilter) || "")}
                                className="h-9 pl-8 pr-3 rounded-md border border-[var(--border)] bg-[var(--input-bg)] text-[var(--fg)] text-sm focus:outline-none"
                                aria-label="Request type filter"
                            >
                                <option value="">All (Latest)</option>
                                <option value="CHAT">Chat Requests</option>
                                <option value="INVITE">Team Invites</option>
                                <option value="JOIN">Applications</option>
                                <option value="FILE">File Shares</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {!showTitle && (
                <div className="flex items-center justify-end">
                    <div className="relative">
                        <ListFilter className="w-4 h-4 text-[var(--muted)] absolute left-2 top-2.5" />
                        <select
                            value={filter}
                            onChange={(e) => setFilter((e.target.value as TypeFilter) || "")}
                            className="h-9 pl-8 pr-3 rounded-md border border-[var(--border)] bg-[var(--input-bg)] text-[var(--fg)] text-sm focus:outline-none"
                            aria-label="Request type filter"
                        >
                            <option value="">All (Latest)</option>
                            <option value="CHAT">Chat Requests</option>
                            <option value="INVITE">Team Invites</option>
                            <option value="JOIN">Applications</option>
                            <option value="FILE">File Shares</option>
                        </select>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {loading ? <div className="text-[var(--muted)]">Loading...</div> :
                    visibleItems.length === 0 ? (
                        <div className="text-[var(--muted)] py-10">
                            No requests yet.
                        </div>
                    ) : (
                        visibleItems.map((req) => (
                            <Card key={req.id} className="p-4 flex items-center justify-between gap-4">
                                <div className="min-w-0 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-bold text-[var(--fg)] text-sm">{typeLabel(req.type)}</p>
                                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", statusStyle(req.status))}>
                                            {req.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-[var(--muted)] truncate">
                                        {requestBodyText(req)}
                                    </p>
                                    <p className="text-xs text-[var(--muted)]">
                                        {req.createdAt ? new Date(req.createdAt).toLocaleString() : "-"}
                                    </p>
                                </div>

                                {req.status === "PENDING" && (
                                    <div className="flex gap-2 shrink-0">
                                        <Button
                                            size="sm"
                                            onClick={() => handleAction(req, "ACCEPTED")}
                                            disabled={actingId === req.id}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 w-8 p-0 rounded-full"
                                        >
                                            <Check className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleAction(req, "DECLINED")}
                                            disabled={actingId === req.id}
                                            className="h-8 w-8 p-0 rounded-full"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )}
                                {req.status === "ACCEPTED" && req.type === "FILE" && (
                                    <div className="flex gap-2 shrink-0">
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => void handleDownload(req)}
                                            disabled={downloadingId === req.id}
                                            className="h-8 gap-1.5"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            {downloadingId === req.id ? "Downloading..." : "받기"}
                                        </Button>
                                    </div>
                                )}
                            </Card>
                        ))
                    )
                }
            </div>
            <AlertModal
                open={notice.open}
                title={notice.title}
                message={notice.message}
                onClose={() => setNotice((prev) => ({ ...prev, open: false }))}
            />
        </div>
    );
}
