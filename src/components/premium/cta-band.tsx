"use client";

import Link from "next/link";
import { ArrowRight, Crown, Gem, LifeBuoy, Send, Zap } from "lucide-react";
import { usePremium } from "@/hooks/use-premium";
import { PLANS } from "@/lib/premium-plans";
import { cn } from "@/lib/utils";

const POINTS = [
  { icon: Zap, label: "Instant downloads" },
  { icon: Gem, label: "Premium Resources" },
  { icon: Send, label: "Private groups" },
  { icon: LifeBuoy, label: "Priority support" },
] as const;

/**
 * "Get Premium" band for static pages. Rendered for everyone on the server
 * (most visitors are not members); a member sees the same box pointing at
 * their benefits instead, so nothing shifts when their state loads.
 */
export function PremiumCtaBand({ className }: { className?: string }) {
  const { me, loading } = usePremium();
  const member = !loading && Boolean(me.subscribed);
  return (
    <aside
      aria-label="Courses Monster Premium"
      className={cn(
        "glass-card edge-gold relative overflow-hidden rounded-feature p-6 sm:p-8",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(28rem_14rem_at_100%_0%,var(--wash-4),transparent_70%)]"
      />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-eyebrow text-gold-ink uppercase">
            <Crown className="h-4 w-4" aria-hidden /> {member ? "You're Premium" : "Premium"}
          </p>
          <h2 className="mt-2 text-heading text-balance">
            {member ? "Everything is unlocked for you" : "Skip the wait on every download"}
          </h2>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {POINTS.map(({ icon: Icon, label }) => (
              <li key={label} className="inline-flex items-center gap-1.5">
                <Icon className="h-4 w-4 text-gold-ink" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
          <Link
            href={member ? "/premium-resources" : "/premium#plans"}
            className="group inline-flex h-12 items-center gap-2 rounded-full bg-gold px-6 font-semibold text-accent-foreground shadow-gold transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            {member ? "Open Premium Resources" : "Get Premium"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <p className="text-xs text-muted-foreground">
            {member ? "Thanks for supporting us." : `From $${PLANS.MONTHLY.priceUsd} a month · UPI, card or crypto`}
          </p>
        </div>
      </div>
    </aside>
  );
}
