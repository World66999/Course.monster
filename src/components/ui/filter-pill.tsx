import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The selectable filter chip used by every listing page.
 *
 * This markup was previously copy-pasted nine times across four filter bars,
 * which is exactly how a product ends up with chips that are subtly different
 * from each other. Selection is communicated by fill *and* by `aria-pressed`,
 * never by colour alone.
 */
export const filterPillClass = (active: boolean, className?: string) =>
  cn(
    "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium",
    // 34px tall as designed, which is fine under a mouse and short of the touch
    // minimum. Grown for real on coarse pointers instead of given `tap-target`:
    // these wrap into `gap-2` rows, so invisible 44px boxes would overlap
    // vertically between rows. 40px + 8px of gap keeps a clear 48px pitch, and
    // desktop density is untouched.
    "pointer-coarse:min-h-11 pointer-coarse:min-w-11 justify-center",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "focus-visible:ring-offset-background active:scale-[0.97]",
    active
      ? "border-primary bg-primary text-primary-foreground shadow-primary"
      : "border-border bg-card text-muted-foreground shadow-soft hover:border-primary/45 hover:bg-primary-soft/50 hover:text-foreground",
    className
  );

export function FilterPill({
  active,
  count,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean; count?: number }) {
  return (
    <button type="button" aria-pressed={active} className={filterPillClass(active, className)} {...props}>
      {children}
      {count != null && (
        <span
          className={cn(
            "numeric rounded-full px-1.5 py-px text-[0.6875rem] leading-4",
            active ? "bg-black/15 dark:bg-white/15" : "bg-muted"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/** The dashed "+n more" / "Show less" chip that expands a truncated chip row. */
export function FilterPillGhost({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex cursor-pointer items-center rounded-full border border-dashed border-border px-3.5 py-1.5 text-sm font-medium text-muted-foreground",
        // Same 40px floor on touch as the pills it sits beside.
        "pointer-coarse:min-h-11 pointer-coarse:min-w-11 justify-center",
        "transition-colors duration-200 hover:border-primary/45 hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
