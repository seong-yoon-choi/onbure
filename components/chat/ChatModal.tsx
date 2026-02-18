"use client";

import { X, Send, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ChatModal({ isOpen, onClose }: ChatModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed bottom-4 right-4 w-96 h-[500px] bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-2xl flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-300">
            <div className="h-12 border-b border-[var(--border)] bg-[var(--card-bg)] flex items-center justify-between px-4">
                <div className="flex items-center gap-2 text-[var(--fg)] font-medium">
                    <MessageSquare className="w-4 h-4 text-[var(--primary)]" />
                    Chat
                </div>
                <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--fg)]">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 bg-[var(--card-bg)] p-4 overflow-y-auto">
                <div className="flex flex-col gap-4 text-center items-center justify-center h-full text-[var(--muted)] text-sm">
                    <MessageSquare className="w-8 h-8 opacity-40" />
                    <p>Select a conversation to start chatting</p>
                </div>
            </div>

            <div className="p-3 bg-[var(--card-bg)] border-t border-[var(--border)]">
                <div className="flex gap-2">
                    <input
                        className="flex-1 bg-[var(--input-bg)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                        placeholder="Type a message..."
                    />
                    <Button size="icon" className="h-9 w-9">
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
