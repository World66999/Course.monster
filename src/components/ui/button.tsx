import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive" | "accent";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

/**
 * Every variant defines the same four states (rest / hover / active / focus) so
 * no control in the product is missing feedback. The lift-on-hover is a
 * transform, never a margin or size change, so it cannot reflow a grid.
 */
const variants: Record<Variant, string> = {
  primary:
    "lit bg-primary text-primary-foreground shadow-primary inset-shadow-highlight " +
    "hover:bg-primary-hover hover:-translate-y-px hover:shadow-elevated " +
    "active:translate-y-0 active:shadow-soft",
  accent:
    "lit bg-accent text-accent-foreground shadow-soft inset-shadow-highlight " +
    "hover:bg-accent-hover hover:-translate-y-px hover:shadow-elevated " +
    "active:translate-y-0 active:shadow-soft",
  secondary:
    "bg-muted text-foreground ring-1 ring-inset ring-border " +
    "hover:bg-border/60 hover:ring-border-strong/50 active:bg-border/80",
  outline:
    "border border-border bg-card shadow-soft " +
    "hover:border-primary/45 hover:bg-primary-soft/60 hover:-translate-y-px " +
    "active:translate-y-0 active:bg-primary-soft",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-border/60",
  destructive:
    "lit bg-destructive text-white shadow-soft inset-shadow-highlight " +
    "hover:brightness-110 hover:-translate-y-px hover:shadow-elevated " +
    "active:translate-y-0 active:brightness-95",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5 rounded-[0.5rem]",
  md: "h-10 px-4 text-sm gap-2 rounded-control",
  lg: "h-12 px-6 text-base gap-2 rounded-control",
  icon: "h-10 w-10 rounded-control",
  "icon-sm": "h-8 w-8 rounded-[0.5rem]",
};

const base =
  "relative inline-flex items-center justify-center font-medium whitespace-nowrap " +
  "transition-[background-color,border-color,color,box-shadow,transform,filter] duration-200 " +
  "ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer touch-manipulation select-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-background " +
  "active:scale-[0.985] disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none " +
  "aria-disabled:pointer-events-none aria-disabled:opacity-45";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /**
   * Shows a spinner and blocks input. The label stays in the DOM at zero
   * opacity so the button keeps its width — a button that shrinks mid-submit
   * shifts everything beside it.
   */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", type = "button", loading = false, disabled, children, ...props },
    ref
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        </span>
      )}
      <span
        className={cn("inline-flex items-center justify-center gap-[inherit]", loading && "opacity-0")}
      >
        {children}
      </span>
    </button>
  )
);
Button.displayName = "Button";

/** Anchor styled as a button (for link CTAs). */
export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}
