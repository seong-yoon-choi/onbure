import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    "rounded-xl border border-[var(--border)] bg-[var(--card-bg)] backdrop-blur-sm shadow-md",
                    className
                )}
                {...props}
            />
        );
    }
);
Card.displayName = "Card";
