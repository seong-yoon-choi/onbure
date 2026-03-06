"use client";

import React from "react";
import { X } from "lucide-react";
import { OpenDmRequest } from "./types";
import { useChat } from "./useChat";
import { ChatSidebar } from "./ChatSidebar";
import { ChatHeader } from "./ChatHeader";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInputArea } from "./ChatInputArea";
import { useLanguage } from "@/components/providers";

export default function ChatWidget({ isOpen, onClose, openDmRequest }: { isOpen: boolean; onClose: () => void; openDmRequest?: OpenDmRequest | null }) {
  const { t } = useLanguage();
  const chat = useChat({ isOpen, onClose, openDmRequest });
  const rect = chat?.rect;
  const rectX = rect?.x;
  const rectY = rect?.y;
  const rectWidth = rect?.width;
  const rectHeight = rect?.height;

  React.useEffect(() => {
    if (
      typeof window === "undefined" ||
      !Number.isFinite(rectX) ||
      !Number.isFinite(rectY) ||
      !Number.isFinite(rectWidth) ||
      !Number.isFinite(rectHeight)
    ) {
      return;
    }
    window.dispatchEvent(
      new CustomEvent("onbure-chat-widget-rect", {
        detail: {
          x: rectX,
          y: rectY,
          width: rectWidth,
          height: rectHeight,
        },
      })
    );
  }, [rectX, rectY, rectWidth, rectHeight]);

  if (!chat || !rect) return null;
  const { isDragging, isCompact, handleResizeStart, handleDragStart, saveRect, profileMenu, handleProfileMenuOpen, widgetRef, RESIZE_HANDLE_SIZE } = chat;

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
          <div className="text-sm font-semibold">{t("chat.widgetTitle")}</div>
          <div
            className="flex-1 h-full cursor-grab active:cursor-grabbing"
            onMouseDown={handleDragStart}
            aria-label={t("chat.dragWindowAria")}
          />
          <button
            onClick={() => {
              saveRect(rect);
              onClose();
            }}
            className="text-[var(--primary-foreground)] hover:opacity-90"
            aria-label={t("chat.closeAria")}
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
          <ChatSidebar chat={chat} />

          <section className="min-w-0 min-h-0 flex flex-col">
            <ChatHeader chat={chat} />
            <ChatMessageList chat={chat} />
            <ChatInputArea chat={chat} />
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
            {profileMenu.targetType === "team" ? t("chat.teamProfile") : t("chat.viewProfile")}
          </button>
        </div>
      )}
    </>
  );
}
