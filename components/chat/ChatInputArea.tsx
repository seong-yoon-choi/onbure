import React from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChat } from "./useChat";
import { useLanguage } from "@/components/providers";

type ChatState = NonNullable<ReturnType<typeof useChat>>;

export function ChatInputArea({ chat }: { chat: ChatState }) {
    const { t } = useLanguage();
    const {
        handleSend,
        messageInputRef,
        activeThread,
        draft,
        setDraft,
        sendLoading,
        errorText
    } = chat;

    return (
        <form onSubmit={handleSend} className="shrink-0 p-3 border-t border-[var(--border)]">
            <div className="flex gap-2">
                <input
                    ref={messageInputRef}
                    className="flex-1 px-3 py-2 border rounded-md text-sm bg-[var(--input-bg)] text-[var(--fg)]"
                    style={{ borderColor: "var(--border)" }}
                    placeholder={activeThread ? t("chat.typeMessagePlaceholder") : t("chat.selectThreadFirst")}
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
    );
}
