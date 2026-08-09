"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Read-only star display. */
export function StarDisplay({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            "h-4 w-4",
            i < Math.round(rating) ? "fill-warning text-warning" : "fill-none text-muted-foreground/40"
          )}
        />
      ))}
    </span>
  );
}

/** Interactive star picker for the review form. */
export function StarInput({
  value,
  onChange,
  "aria-label": ariaLabel = "Rating",
}: {
  value: number;
  onChange: (value: number) => void;
  "aria-label"?: string;
}) {
  const [hover, setHover] = React.useState(0);
  const display = hover || value;
  const buttonRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const current = value || 1;

  function onKeyDown(e: React.KeyboardEvent) {
    if (!["ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const delta = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : -1;
    const next = Math.min(5, Math.max(1, current + delta));
    onChange(next);
    buttonRefs.current[next - 1]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={ariaLabel} onKeyDown={onKeyDown} className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => {
        const star = i + 1;
        return (
          <button
            key={star}
            ref={(el) => {
              buttonRefs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            tabIndex={star === current ? 0 : -1}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            onFocus={() => setHover(star)}
            onBlur={() => setHover(0)}
            className="cursor-pointer rounded p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Star
              className={cn(
                "h-6 w-6 transition-colors",
                star <= display ? "fill-warning text-warning" : "fill-none text-muted-foreground/40"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
