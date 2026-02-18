"use client";

import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ModalShellProps {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    className?: string;
    closeOnOverlayClick?: boolean;
}

function ModalShell({
    open,
    onClose,
    children,
    className,
    closeOnOverlayClick = true,
}: ModalShellProps) {
    useEffect(() => {
        if (!open) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 backdrop-blur-sm px-4"
            onMouseDown={(event) => {
                if (closeOnOverlayClick && event.target === event.currentTarget) {
                    onClose();
                }
            }}
            role="dialog"
            aria-modal="true"
        >
            <div
                className={cn(
                    "w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] shadow-2xl",
                    className
                )}
            >
                {children}
            </div>
        </div>
    );
}

interface AlertModalProps {
    open: boolean;
    title: string;
    message: string;
    actionLabel?: string;
    onClose: () => void;
}

export function AlertModal({
    open,
    title,
    message,
    actionLabel = "OK",
    onClose,
}: AlertModalProps) {
    return (
        <ModalShell open={open} onClose={onClose}>
            <div className="px-5 py-4 border-b border-[var(--border)]">
                <h3 className="text-base font-semibold text-[var(--fg)]">{title}</h3>
            </div>
            <div className="px-5 py-4">
                <p className="text-sm text-[var(--muted)]">{message}</p>
            </div>
            <div className="px-5 py-4 border-t border-[var(--border)] flex items-center justify-end">
                <Button type="button" size="sm" onClick={onClose}>
                    {actionLabel}
                </Button>
            </div>
        </ModalShell>
    );
}

interface ConfirmModalProps {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmVariant?: "primary" | "destructive" | "outline" | "secondary" | "ghost";
    isProcessing?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmModal({
    open,
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    confirmVariant = "primary",
    isProcessing = false,
    onConfirm,
    onCancel,
}: ConfirmModalProps) {
    return (
        <ModalShell open={open} onClose={onCancel}>
            <div className="px-5 py-4 border-b border-[var(--border)]">
                <h3 className="text-base font-semibold text-[var(--fg)]">{title}</h3>
            </div>
            <div className="px-5 py-4">
                <p className="text-sm text-[var(--muted)]">{message}</p>
            </div>
            <div className="px-5 py-4 border-t border-[var(--border)] flex items-center justify-end gap-2">
                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={onCancel}
                    disabled={isProcessing}
                >
                    {cancelLabel}
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant={confirmVariant}
                    onClick={onConfirm}
                    disabled={isProcessing}
                >
                    {confirmLabel}
                </Button>
            </div>
        </ModalShell>
    );
}
