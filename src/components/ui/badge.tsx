import * as React from "react";
import { cn } from "@/lib/utils";

type Variant =
  | "default"
  | "secondary"
  | "outline"
  | "success"
  | "warning"
  | "accent"
  | "destructive"
  | "info";

/**
 * Tinted fill + inset ring rather than a solid block: a solid badge competes
 * with buttons for attention, and in a card grid there are often three badges
 * per card. Each variant pairs a `-soft` surface with its full-strength text
 * colour, both of which are contrast-checked in globals.css.
 */
const variants: Record<Variant, string> = {
  default: "bg-primary-soft text-primary ring-1 ring-inset ring-primary/20",
  // Citrus is a fill colour (see globals.css): solid lime carrying ink text.
  accent: "bg-accent text-accent-foreground ring-1 ring-inset ring-black/5",
  secondary: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
  outline: "border border-border text-muted-foreground",
  success: "bg-success-soft text-success ring-1 ring-inset ring-success/20",
  warning: "bg-warning-soft text-warning ring-1 ring-inset ring-warning/20",
  destructive: "bg-destructive-soft text-destructive ring-1 ring-inset ring-destructive/20",
  info: "bg-info-soft text-info ring-1 ring-inset ring-info/20",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        "[&>svg]:h-3 [&>svg]:w-3 [&>svg]:shrink-0",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

/**
 * A tiny dot + label used for live status (bot online, job running). Separate
 * from Badge because it carries a state, not a category, and colour alone must
 * never be the signal — the label is always present.
 */
export function StatusDot({
  tone = "neutral",
  pulse = false,
  className,
}: {
  tone?: "neutral" | "success" | "warning" | "destructive";
  pulse?: boolean;
  className?: string;
}) {
  const tones = {
    neutral: "bg-muted-foreground",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
  } as const;
  return (
    <span className={cn("relative flex h-2 w-2 shrink-0", className)} aria-hidden>
      {pulse && (
        <span
          className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", tones[tone])}
        />
      )}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", tones[tone])} />
    </span>
  );
}
