import React from "react";
import { Loader2, UserRound, Users as UsersIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatUnreadCount } from "./utils";
import { useChat } from "./useChat";
import { useLanguage } from "@/components/providers";

type ChatState = NonNullable<ReturnType<typeof useChat>>;

export function ChatSidebar({ chat }: { chat: ChatState }) {
  const { t } = useLanguage();
  const {
    isCompact,
    activeTab,
    setActiveTab,
    directoryLoading,
    threadLoading,
    dmUsers,
    teams,
    openDmThread,
    openTeamThread,
    openProfileMenu,
    dmLastMessageByUserId,
    dmUnreadCountByUserId,
    teamLastMessageByTeamId,
    teamUnreadCountByTeamId,
  } = chat;

  return (
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
            {t("chat.tabTeam")}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-2">
        {(directoryLoading || threadLoading) && (
          <div className="h-full flex items-center justify-center text-[var(--muted)] text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            {t("chat.loading")}
          </div>
        )}

        {!directoryLoading && !threadLoading && activeTab === "dm" && dmUsers.length === 0 && (
          <div className="text-xs text-[var(--muted)] p-2">{t("chat.noApprovedConnections")}</div>
        )}
        {!directoryLoading && !threadLoading && activeTab === "team" && teams.length === 0 && (
          <div className="text-xs text-[var(--muted)] p-2">{t("chat.noTeamFound")}</div>
        )}

        {!directoryLoading &&
          !threadLoading &&
          activeTab === "dm" &&
          dmUsers.map((user) => {
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
                    <p className="text-sm font-medium text-[var(--fg)] truncate">{user.username}</p>
                    <p className="text-[11px] text-[var(--muted)] truncate">{dmLastMessageByUserId[user.userId] || t("chat.noMessagesYet")}</p>
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

        {!directoryLoading &&
          !threadLoading &&
          activeTab === "team" &&
          teams.map((team) => {
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
                    <p className="text-[11px] text-[var(--muted)] truncate">{teamLastMessageByTeamId[team.teamId] || t("chat.noMessagesYet")}</p>
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
  );
}

