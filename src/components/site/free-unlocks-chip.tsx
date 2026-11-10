"use client";

import * as React from "react";
import Link from "next/link";
import { Crown, Gift } from "lucide-react";
import { cn } from "@/lib/utils";

type Status =
  | { premium: true }
  | { premium: false; used: number; limit: number; resetsAt: string };

let shared: Promise<Status | null> | null = null;
/** One request per page view, shared by every chip on the page. */
function load(): Promise<Status | null> {
  shared ??= fetch("/api/free-unlocks/status", { cache: "no-store", credentials: "same-origin" })
    .then((r) => (r.ok ? (r.json() as Promise<Status>) : null))
    .catch(() => null);
  return shared;
}

/**
 * "2 of 3 free unlocks left today".
 *
 * Display only: the number comes from a read-only endpoint and the limit is
 * enforced on the server in the download flow. The chip keeps its size while
 * loading (a skeleton of the same height), so nothing shifts when the count
 * arrives, and it simply stays hidden if the request fails.
 */
export function FreeUnlocksChip({
  className,
  variant = "chip",
}: {
  className?: string;
  /** `chip`: one-line pill. `panel`: the fuller block on the course page. */
  variant?: "chip" | "panel";
}) {
  const [status, setStatus] = React.useState<Status | null | undefined>(undefined);

  React.useEffect(() => {
    let alive = true;
    // After the page is interactive; the count is never needed for first paint.
    const start = () => void load().then((s) => alive && setStatus(s));
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(start, { timeout: 2000 })
      : window.setTimeout(start, 400);
    return () => {
      alive = false;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, []);

  const base =
    variant === "panel"
      ? "flex min-h-[4.25rem] items-center gap-3 rounded-card border px-4 py-3 text-sm"
      : "inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-sm";

  if (status === undefined) {
    return <div aria-hidden className={cn(base, "skeleton border-transparent", variant === "chip" && "w-56", className)} />;
  }
  if (status === null) return null;

  if (status.premium) {
    return (
      <div className={cn(base, "border-gold/40 bg-gold-soft text-gold-ink", className)} data-free-chip="premium">
        <Crown className="h-4 w-4 shrink-0" aria-hidden />
        <span className="font-semibold">Premium: instant, unlimited downloads</span>
      </div>
    );
  }

  const left = Math.max(0, status.limit - status.used);
  const dots = Math.min(status.limit, 6);
  return (
    <div
      className={cn(
        base,
        left > 0 ? "border-primary/20 bg-primary-soft/60" : "border-warning/30 bg-warning-soft",
        className
      )}
      data-free-chip={left}
    >
      <Gift className={cn("h-4 w-4 shrink-0", left > 0 ? "text-primary" : "text-warning")} aria-hidden />
      <span className="min-w-0">
        <span className="font-semibold text-foreground">
          {left} of {status.limit} free unlocks left today
        </span>
        {variant === "panel" && (
          <span className="block text-xs text-muted-foreground">
            {left > 0 ? (
              "Resets at midnight IST. Opening a course you already unlocked is free."
            ) : (
              <>
                Resets at midnight IST.{" "}
                <Link href="/premium#plans" className="font-semibold text-gold-ink underline underline-offset-2">
                  Premium has no limit
                </Link>
              </>
            )}
          </span>
        )}
      </span>
      <span className="ml-auto flex shrink-0 gap-1" aria-hidden>
        {Array.from({ length: dots }, (_, i) => (
          <span
            key={i}
            className={cn("h-1.5 w-4 rounded-full", i < status.used ? "bg-muted-foreground/35" : "bg-primary")}
          />
        ))}
      </span>
    </div>
  );
}
