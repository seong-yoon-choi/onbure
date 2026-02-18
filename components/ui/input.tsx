import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, ...props }, ref) => {
        return (
            <div className="w-full space-y-1.5">
                {label && (
                    <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider ml-1">
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    className={cn(
                        "flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40 focus:border-[var(--ring)] transition-all",
                        error && "border-red-500/50 focus:ring-red-500/20",
                        className
                    )}
                    {...props}
                />
                {error && <p className="text-xs text-red-400 ml-1">{error}</p>}
            </div>
        );
    }
);
Input.displayName = "Input";
