"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Globe, Paperclip } from "lucide-react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useAuditRealtime } from "@/lib/realtime/use-audit-realtime";

interface ChatMessage {
    id: string;
    senderId: string;
    bodyOriginal: string;
    bodyTranslated: string;
    createdAt?: string;
}

export default function ChatRoomPage() {
    const { id } = useParams<{ id: string }>();
    const threadId = Array.isArray(id) ? id[0] : id;
    const { data: session } = useSession();
    const currentUserId = String((session?.user as { id?: string } | undefined)?.id || "").trim();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [showOriginal, setShowOriginal] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const isPageVisible = () => (typeof document === "undefined" ? true : document.visibilityState === "visible");

    const fetchMessages = useCallback(async () => {
        if (!threadId) return;

        const res = await fetch(`/api/chat/${threadId}`);
        if (res.ok) {
            const data = (await res.json()) as ChatMessage[];
            setMessages(data);
        }
    }, [threadId]);

    useEffect(() => {
        void fetchMessages();
    }, [fetchMessages]);

    useEffect(() => {
        const onFocus = () => {
            if (!isPageVisible()) return;
            void fetchMessages();
        };
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                void fetchMessages();
            }
        };

        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [fetchMessages]);

    useAuditRealtime(Boolean(threadId) && Boolean(currentUserId), (row) => {
        if (!threadId || !isPageVisible()) return;

        const category = String(row.category || "").toLowerCase();
        if (category !== "chat") return;

        const metadata = (row.metadata || {}) as Record<string, unknown>;
        const metadataThreadId = String(metadata.threadId || "").trim();
        if (metadataThreadId && metadataThreadId !== threadId) return;

        const actorUserId = String(row.actor_user_id || "").trim();
        const targetUserId = String(row.target_user_id || "").trim();
        const isDirectEvent = actorUserId === currentUserId || targetUserId === currentUserId;
        if (!metadataThreadId && !isDirectEvent) return;

        void fetchMessages();
    });

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !threadId) return;

        const tempInput = input;
        setInput(""); // Optimistic clear

        await fetch(`/api/chat/${threadId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // Mock target lang - defaults to Korean or user preference (mocked)
            body: JSON.stringify({ content: tempInput, targetLang: "Korean" }),
        });

        void fetchMessages();
    };

    const isDM = String(threadId || "").startsWith("dm::");

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)]">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--border)]">
                <h2 className="text-xl font-bold text-[var(--fg)]">Chat</h2>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowOriginal(!showOriginal)}
                    className={cn("gap-2", showOriginal ? "text-[var(--primary)] bg-[var(--primary)]/10" : "text-[var(--muted)]")}
                >
                    <Globe className="w-4 h-4" />
                    {showOriginal ? "Original" : "Translated"}
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2" ref={scrollRef}>
                {messages.map((msg) => {
                    const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
                    const isMe = msg.senderId === sessionUserId;
                    return (
                        <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                            <div className={cn(
                                "max-w-[70%] rounded-2xl p-4",
                                isMe ? "bg-[var(--primary)] text-[var(--primary-foreground)] rounded-br-none" : "bg-[var(--card-bg)] text-[var(--fg)] rounded-bl-none"
                            )}>
                                <p className="text-sm">
                                    {showOriginal ? msg.bodyOriginal : (msg.bodyTranslated || msg.bodyOriginal)}
                                </p>
                                {showOriginal && msg.bodyTranslated && (
                                    <p className="text-xs text-white/50 border-t border-white/10 mt-2 pt-2">
                                        {msg.bodyTranslated}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <form onSubmit={handleSend} className="mt-4 flex gap-2">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-[var(--muted)] hover:text-[var(--fg)]"
                    disabled={isDM} // DM disallows files
                    title={isDM ? "File upload disabled in DM" : "Attach file"}
                >
                    <Paperclip className="w-5 h-5" />
                </Button>
                <Input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-slate-900 border-slate-800 focus:ring-violet-500"
                />
                <Button type="submit" variant="primary">
                    <Send className="w-4 h-4" />
                </Button>
            </form>
        </div>
    );
}
