"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { MessageSquare, Users } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ChatThread {
    id: string;
    threadId: string;
    type: "DM" | "TEAM";
    title: string;
}

export default function ChatListPage() {
    const [threads, setThreads] = useState<ChatThread[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchThreads() {
            const res = await fetch("/api/chat");
            if (res.ok) {
                const data = (await res.json()) as ChatThread[];
                setThreads(data);
            }
            setLoading(false);
        }

        void fetchThreads();
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold text-white">Chat</h1>
                <p className="text-slate-400">Your conversations and team chats.</p>
            </div>

            <div className="grid gap-3">
                {loading ? (
                    <div>Loading...</div>
                ) : threads.length === 0 ? (
                    <div className="text-center py-20 border border-dashed border-slate-800 rounded-xl">
                        <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-500">No active conversations.</p>
                    </div>
                ) : (
                    threads.map((thread) => (
                        <Link key={thread.id} href={`/chat/${thread.threadId}`}>
                            <Card className="p-4 hover:border-violet-500/30 transition-colors cursor-pointer flex items-center gap-4">
                                <div className={cn(
                                    "h-12 w-12 rounded-full flex items-center justify-center text-white",
                                    thread.type === "TEAM" ? "bg-violet-600" : "bg-emerald-600"
                                )}>
                                    {thread.type === "TEAM" ? <Users className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">{thread.title || "Chat"}</h3>
                                    <p className="text-xs text-slate-500 uppercase tracking-widest">{thread.type}</p>
                                </div>
                            </Card>
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
}
