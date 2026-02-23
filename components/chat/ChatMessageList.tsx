import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { uniqueMessageKey } from "./utils";
import { useChat } from "./useChat";

type ChatState = NonNullable<ReturnType<typeof useChat>>;

export function ChatMessageList({ chat }: { chat: ChatState }) {
    const {
        messagesLoading,
        activeThread,
        messages,
        currentUserId,
        lastMyDmMessageKey,
        dmReadReceipt,
        isLastMyDmMessageRead
    } = chat;

    return (
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
                    <div key={messageKey} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
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
    );
}
