import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "ghost" | "destructive" | "outline";
    size?: "sm" | "md" | "lg" | "icon";
    isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "primary", size = "md", isLoading, children, disabled, ...props }, ref) => {
        const variants = {
            primary: "bg-[var(--primary)] text-[var(--primary-foreground)] hover:brightness-95 shadow-md",
            secondary: "bg-[var(--card-bg)] text-[var(--fg)] hover:bg-[var(--card-bg-hover)] border border-[var(--border)]",
            ghost: "bg-transparent text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--card-bg)]",
            destructive: "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20",
            outline: "bg-transparent border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--card-bg)]",
        };

        const sizes = {
            sm: "h-8 px-3 text-xs",
            md: "h-10 px-4 text-sm",
            lg: "h-12 px-6 text-base",
            icon: "h-9 w-9 p-0",
        };

        return (
            <button
                ref={ref}
                disabled={disabled || isLoading}
                className={cn(
                    "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40 disabled:opacity-50 disabled:cursor-not-allowed",
                    variants[variant],
                    sizes[size],
                    className
                )}
                {...props}
            >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {children}
            </button>
        );
    }
);
Button.displayName = "Button";
