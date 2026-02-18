"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { X, Inbox } from "lucide-react";
import RequestsPanel from "@/components/requests/RequestsPanel";

interface RequestsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

const STORAGE_KEY = "onbure.requestsWidget.rect";

function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
}

function clampRange(v: number, minValue: number, maxValue: number) {
    const lo = Math.min(minValue, maxValue);
    const hi = Math.max(minValue, maxValue);
    return clamp(v, lo, hi);
}

export default function RequestsModal({ isOpen, onClose }: RequestsModalProps) {
    const [mounted, setMounted] = useState(false);
    const [rect, setRect] = useState<Rect | null>(null);
    const rectRef = useRef<Rect | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0, rectX: 0, rectY: 0 });
    const [isResizing, setIsResizing] = useState<string | null>(null);
    const [resizeBase, setResizeBase] = useState<Rect | null>(null);

    const defaults = { width: 760, height: 620 };
    const min = { width: 460, height: 360 };
    const max = { width: 980, height: 860 };
    const EDGE_MARGIN = 24;
    const TOP_MARGIN = 80;
    const RESIZE_HANDLE_SIZE = 10;

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        rectRef.current = rect;
    }, [rect]);

    useEffect(() => {
        if (!mounted) return;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as Rect;
                if (
                    Number.isFinite(parsed?.x) &&
                    Number.isFinite(parsed?.y) &&
                    Number.isFinite(parsed?.width) &&
                    Number.isFinite(parsed?.height)
                ) {
                    setRect(parsed);
                    return;
                }
            }
        } catch {
            // ignore
        }

        const w = defaults.width;
        const h = defaults.height;
        const x = typeof window !== "undefined" ? window.innerWidth - w - EDGE_MARGIN : 0;
        const y = TOP_MARGIN;
        setRect({ x, y, width: w, height: h });
    }, [mounted, defaults.width, defaults.height, EDGE_MARGIN, TOP_MARGIN]);

    const saveRect = useCallback((next: Rect) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
            // ignore
        }
    }, []);

    const clampDraggedRect = useCallback(
        (next: Rect) => {
            const winW = typeof window !== "undefined" ? window.innerWidth : 1280;
            const winH = typeof window !== "undefined" ? window.innerHeight : 800;
            const width = clampRange(next.width, min.width, max.width);
            const height = clampRange(next.height, min.height, max.height);
            const minX = EDGE_MARGIN - width;
            const maxX = winW - EDGE_MARGIN;
            const minY = TOP_MARGIN;
            const maxY = winH - EDGE_MARGIN;
            return {
                x: clamp(next.x, minX, maxX),
                y: clamp(next.y, minY, maxY),
                width,
                height,
            };
        },
        [EDGE_MARGIN, TOP_MARGIN, max.height, max.width, min.height, min.width]
    );

    const clampResizedRect = useCallback(
        (base: Rect, edge: string, deltaX: number, deltaY: number) => {
            const winW = typeof window !== "undefined" ? window.innerWidth : 1280;
            const winH = typeof window !== "undefined" ? window.innerHeight : 800;

            const hasLeft = edge.includes("left");
            const hasRight = edge.includes("right");
            const hasTop = edge.includes("top");
            const hasBottom = edge.includes("bottom");

            let width = base.width;
            let height = base.height;
            let x = base.x;
            let y = base.y;

            const rightAnchor = base.x + base.width;
            const bottomAnchor = base.y + base.height;

            if (hasLeft || hasRight) {
                width = hasLeft ? base.width - deltaX : base.width + deltaX;

                if (hasLeft) {
                    const minWidthByVisibility = Math.max(min.width, rightAnchor - (winW - EDGE_MARGIN));
                    width = clampRange(width, minWidthByVisibility, max.width);
                    x = rightAnchor - width;
                } else {
                    const minWidthByVisibility = Math.max(min.width, EDGE_MARGIN - base.x);
                    width = clampRange(width, minWidthByVisibility, max.width);
                    x = base.x;
                }
            }

            if (hasTop || hasBottom) {
                height = hasTop ? base.height - deltaY : base.height + deltaY;

                if (hasTop) {
                    const minHeightByBottomVisibility = Math.max(min.height, bottomAnchor - (winH - EDGE_MARGIN));
                    const maxHeightByTopMargin = Math.min(max.height, bottomAnchor - TOP_MARGIN);
                    height = clampRange(height, minHeightByBottomVisibility, maxHeightByTopMargin);
                    y = bottomAnchor - height;
                } else {
                    const minHeightByVisibility = Math.max(min.height, EDGE_MARGIN - base.y);
                    height = clampRange(height, minHeightByVisibility, max.height);
                    y = base.y;
                }
            }

            if (!hasLeft && !hasRight) {
                const minX = EDGE_MARGIN - width;
                const maxX = winW - EDGE_MARGIN;
                x = clamp(x, minX, maxX);
            }
            if (!hasTop && !hasBottom) {
                const minY = TOP_MARGIN;
                const maxY = winH - EDGE_MARGIN;
                y = clamp(y, minY, maxY);
            }

            const minX = EDGE_MARGIN - width;
            const maxX = winW - EDGE_MARGIN;
            const maxY = winH - EDGE_MARGIN;
            x = clamp(x, minX, maxX);
            y = clamp(y, TOP_MARGIN, maxY);

            return { x, y, width, height };
        },
        [EDGE_MARGIN, TOP_MARGIN, max.height, max.width, min.height, min.width]
    );

    const handleDragStart = (event: React.MouseEvent) => {
        if (!rect || event.button !== 0) return;
        event.preventDefault();
        setIsDragging(true);
        setDragStart({ x: event.clientX, y: event.clientY, rectX: rect.x, rectY: rect.y });
    };

    const handleResizeStart = (event: React.MouseEvent, edge: string) => {
        if (!rect || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        setIsResizing(edge);
        setResizeBase(rect);
        setDragStart({ x: event.clientX, y: event.clientY, rectX: rect.x, rectY: rect.y });
    };

    useEffect(() => {
        if (!isDragging && !isResizing) return;

        const onMouseMove = (event: MouseEvent) => {
            const currentRect = rectRef.current;
            if (!currentRect) return;

            const deltaX = event.clientX - dragStart.x;
            const deltaY = event.clientY - dragStart.y;

            if (isDragging) {
                const dragged = clampDraggedRect({
                    ...currentRect,
                    x: dragStart.rectX + deltaX,
                    y: dragStart.rectY + deltaY,
                });
                setRect(dragged);
                return;
            }

            if (isResizing && resizeBase) {
                const resized = clampResizedRect(resizeBase, isResizing, deltaX, deltaY);
                setRect(resized);
            }
        };

        const onMouseUp = () => {
            if (rectRef.current) saveRect(rectRef.current);
            setIsDragging(false);
            setIsResizing(null);
            setResizeBase(null);
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [clampDraggedRect, clampResizedRect, dragStart, isDragging, isResizing, resizeBase, saveRect]);

    useEffect(() => {
        if (!mounted || !rect) return;
        const onResize = () => {
            setRect((prev) => (prev ? clampDraggedRect(prev) : prev));
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [mounted, rect, clampDraggedRect]);

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !mounted || !rect) return null;

    return (
        <div
            className="fixed z-[48] rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] shadow-2xl overflow-hidden flex flex-col"
            style={{
                left: `${rect.x}px`,
                top: `${rect.y}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                cursor: isDragging ? "grabbing" : "default",
            }}
            role="dialog"
            aria-modal="false"
            aria-label="Requests"
        >
            {["top", "bottom", "left", "right", "top-left", "top-right", "bottom-left", "bottom-right"].map((edge) => (
                <div
                    key={edge}
                    onMouseDown={(event) => handleResizeStart(event, edge)}
                    className="absolute"
                    style={{
                        cursor:
                            edge === "top" || edge === "bottom"
                                ? "ns-resize"
                                : edge === "left" || edge === "right"
                                    ? "ew-resize"
                                    : edge === "top-left" || edge === "bottom-right"
                                        ? "nwse-resize"
                                        : "nesw-resize",
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

            <div className="h-12 border-b border-[var(--border)] bg-[var(--card-bg)] flex items-center gap-3 px-4 select-none">
                <div className="flex items-center gap-2 text-[var(--fg)] font-medium">
                    <Inbox className="w-4 h-4 text-[var(--primary)]" />
                    Requests
                </div>
                <div
                    className="flex-1 h-full cursor-grab active:cursor-grabbing"
                    onMouseDown={handleDragStart}
                    aria-label="Drag requests window"
                />
                <button
                    type="button"
                    onClick={() => {
                        saveRect(rect);
                        onClose();
                    }}
                    className="text-[var(--muted)] hover:text-[var(--fg)]"
                    aria-label="Close requests"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
                <RequestsPanel showTitle={false} />
            </div>
        </div>
    );
}
