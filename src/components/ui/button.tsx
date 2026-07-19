import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground inset-shadow-[0_1px_0_0_rgba(255,255,255,0.18)] shadow-sm shadow-primary/25 hover:bg-primary-hover hover:shadow-md hover:shadow-primary/30 hover:-translate-y-px active:translate-y-0",
  secondary: "bg-muted text-foreground hover:bg-border/70",
  outline: "border border-border bg-card shadow-soft hover:border-primary/35 hover:bg-muted/60",
  ghost: "hover:bg-muted",
  destructive:
    "bg-destructive text-white shadow-sm shadow-destructive/25 hover:opacity-90 hover:shadow-md hover:shadow-destructive/30",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
  icon: "h-9 w-9",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";

/** Anchor styled as a button (for link CTAs). */
export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 active:scale-[0.98]",
    variants[variant],
    sizes[size],
    className
  );
}
