"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ModalShellProps {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    className?: string;
    closeOnOverlayClick?: boolean;
    labelledBy?: string;
    describedBy?: string;
}

export function ModalShell({
    open,
    onClose,
    children,
    className,
    closeOnOverlayClick = true,
    labelledBy,
    describedBy,
}: ModalShellProps) {
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const previousActiveElementRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!open) return;

        previousActiveElementRef.current = document.activeElement as HTMLElement | null;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const getFocusableElements = () => {
            if (!dialogRef.current) return [] as HTMLElement[];
            return Array.from(
                dialogRef.current.querySelectorAll<HTMLElement>(
                    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
                )
            ).filter((element) => !element.hasAttribute("aria-hidden"));
        };

        const rafId = window.requestAnimationFrame(() => {
            const focusables = getFocusableElements();
            if (focusables.length > 0) {
                focusables[0].focus();
                return;
            }
            dialogRef.current?.focus();
        });

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
                return;
            }

            if (event.key !== "Tab") return;
            const focusables = getFocusableElements();

            if (focusables.length === 0) {
                event.preventDefault();
                dialogRef.current?.focus();
                return;
            }

            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = document.activeElement as HTMLElement | null;
            const isInside = active ? dialogRef.current?.contains(active) : false;

            if (event.shiftKey) {
                if (!isInside || active === first) {
                    event.preventDefault();
                    last.focus();
                }
                return;
            }

            if (!isInside || active === last) {
                event.preventDefault();
                first.focus();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.cancelAnimationFrame(rafId);
            window.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = previousOverflow;
            previousActiveElementRef.current?.focus();
        };
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
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledBy}
                aria-describedby={describedBy}
                tabIndex={-1}
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
    const titleId = useId();
    const descriptionId = useId();

    return (
        <ModalShell open={open} onClose={onClose} labelledBy={titleId} describedBy={descriptionId}>
            <div className="px-5 py-4 border-b border-[var(--border)]">
                <h3 id={titleId} className="text-base font-semibold text-[var(--fg)]">
                    {title}
                </h3>
            </div>
            <div className="px-5 py-4">
                <p id={descriptionId} className="text-sm text-[var(--muted)]">
                    {message}
                </p>
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
    children?: ReactNode;
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
    children,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    confirmVariant = "primary",
    isProcessing = false,
    onConfirm,
    onCancel,
}: ConfirmModalProps) {
    const titleId = useId();
    const descriptionId = useId();

    return (
        <ModalShell open={open} onClose={onCancel} labelledBy={titleId} describedBy={descriptionId}>
            <div className="px-5 py-4 border-b border-[var(--border)]">
                <h3 id={titleId} className="text-base font-semibold text-[var(--fg)]">
                    {title}
                </h3>
            </div>
            <div className="px-5 py-4">
                <p id={descriptionId} className="text-sm text-[var(--muted)]">
                    {message}
                </p>
                {children ? <div className="mt-3">{children}</div> : null}
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
