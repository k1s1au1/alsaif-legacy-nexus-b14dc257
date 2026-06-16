import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const PrimaryButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => (
    <button
      ref={ref}
      {...props}
      className={cn(
        "w-full h-12 rounded-2xl bg-[var(--primary)] text-white font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  ),
);
PrimaryButton.displayName = "PrimaryButton";

export const SecondaryButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => (
    <button
      ref={ref}
      {...props}
      className={cn(
        "w-full h-12 rounded-2xl bg-white text-[var(--primary)] font-semibold text-sm border border-[#EAEAEA] transition-all active:scale-[0.98]",
        className,
      )}
    >
      {children}
    </button>
  ),
);
SecondaryButton.displayName = "SecondaryButton";

export const DangerButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => (
    <button
      ref={ref}
      {...props}
      className={cn(
        "w-full h-12 rounded-2xl bg-[var(--saudi-red)] text-white font-semibold text-sm active:scale-[0.98]",
        className,
      )}
    >
      {children}
    </button>
  ),
);
DangerButton.displayName = "DangerButton";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("bg-card rounded-[20px] p-5", className)}
      style={{ boxShadow: "0 4px 16px -8px rgba(0,0,0,0.08), 0 1px 4px -1px rgba(0,0,0,0.04)" }}
    >
      {children}
    </div>
  );
}
