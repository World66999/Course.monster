import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "secondary" | "outline" | "success" | "warning";

const variants: Record<Variant, string> = {
  default:
    "bg-primary/12 text-primary ring-1 ring-inset ring-primary/15 dark:bg-primary/20 dark:text-primary-hover dark:ring-primary/25",
  secondary: "bg-muted text-muted-foreground ring-1 ring-inset ring-border/60",
  outline: "border border-border text-muted-foreground",
  success: "bg-success/12 text-success ring-1 ring-inset ring-success/20",
  warning: "bg-warning/12 text-warning ring-1 ring-inset ring-warning/20",
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
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
