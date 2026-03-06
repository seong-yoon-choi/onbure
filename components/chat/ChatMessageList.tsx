import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { uniqueMessageKey } from "./utils";
import { useChat } from "./useChat";
import { useLanguage } from "@/components/providers";

type ChatState = NonNullable<ReturnType<typeof useChat>>;

export function ChatMessageList({ chat }: { chat: ChatState }) {
    const { t } = useLanguage();
    const [showOriginalByMessageKey, setShowOriginalByMessageKey] = React.useState<Record<string, boolean>>({});
    const {
        messagesLoading,
        activeThread,
        messages,
        currentUserId,
        lastMyDmMessageKey,
        dmReadReceipt,
        isLastMyDmMessageRead,
    } = chat;
    const activeThreadId = activeThread?.threadId || "";

    React.useEffect(() => {
        setShowOriginalByMessageKey({});
    }, [activeThreadId]);

    return (
        <div className="flex-1 min-h-0 overflow-auto p-3 space-y-2">
            {messagesLoading && (
                <div className="h-full flex items-center justify-center text-[var(--muted)] text-sm">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {t("chat.messagesLoading")}
                </div>
            )}

            {!messagesLoading && !activeThread && (
                <div className="h-full flex items-center justify-center text-[var(--muted)] text-sm text-center px-4">
                    {t("chat.selectProfileLeft")}
                </div>
            )}

            {!messagesLoading && activeThread && messages.length === 0 && (
                <div className="h-full flex items-center justify-center text-[var(--muted)] text-sm text-center px-4">
                    {t("chat.noMessagesStart")}
                </div>
            )}

            {!messagesLoading &&
                activeThread &&
                messages.map((message) => {
                    const senderId = (message.senderId || "").trim();
                    const isMine = Boolean(currentUserId) && senderId === currentUserId;
                    const showSenderName = activeThread.type === "team";
                    const senderLabel = isMine ? t("chat.you") : message.senderUsername || senderId || t("friends.unknown");
                    const messageKey = uniqueMessageKey(message);
                    const originalBody = String(message.bodyOriginal || "");
                    const translatedBody = String(message.bodyTranslated || "").trim();
                    const hasTranslatedBody = Boolean(translatedBody) && translatedBody !== originalBody;
                    const isOriginalVisible = Boolean(showOriginalByMessageKey[messageKey]);
                    const primaryBody = hasTranslatedBody ? translatedBody : originalBody;
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
                                    <p className="whitespace-pre-wrap break-words">{primaryBody}</p>
                                    {hasTranslatedBody && (
                                        <div className="mt-1.5">
                                            <button
                                                type="button"
                                                className={cn(
                                                    "text-[10px] underline underline-offset-2",
                                                    isMine
                                                        ? "text-[var(--primary-foreground)]/75 hover:text-[var(--primary-foreground)]"
                                                        : "text-[var(--muted)] hover:text-[var(--fg)]"
                                                )}
                                                onClick={() =>
                                                    setShowOriginalByMessageKey((previous) => ({
                                                        ...previous,
                                                        [messageKey]: !previous[messageKey],
                                                    }))
                                                }
                                            >
                                                {isOriginalVisible ? t("chat.hideOriginal") : t("chat.viewOriginal")}
                                            </button>
                                        </div>
                                    )}
                                    {hasTranslatedBody && isOriginalVisible && (
                                        <p
                                            className={cn(
                                                "mt-1 whitespace-pre-wrap break-words border-t pt-1.5 text-[11px]",
                                                isMine
                                                    ? "border-[var(--primary-foreground)]/25 text-[var(--primary-foreground)]/85"
                                                    : "border-[var(--border)] text-[var(--muted)]"
                                            )}
                                        >
                                            {originalBody}
                                        </p>
                                    )}
                                </div>
                                {showDmReadReceipt && (
                                    <p className="mt-1 text-[10px] text-[var(--muted)] text-right pr-1">
                                        {isLastMyDmMessageRead ? t("chat.read") : t("chat.unread")}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
        </div>
    );
}

