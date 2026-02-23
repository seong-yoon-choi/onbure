import React from "react";
import { UserRound, Users as UsersIcon } from "lucide-react";
import { useChat } from "./useChat";

type ChatState = NonNullable<ReturnType<typeof useChat>>;

export function ChatHeader({ chat }: { chat: ChatState }) {
    const { activeDmUserId, activeTeamId, activeThreadLabel, openProfileMenu } = chat;

    return (
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
    );
}
