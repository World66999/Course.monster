"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Crown, History, Hourglass, RefreshCw, ShieldCheck, Zap } from "lucide-react";
import { PLANS, type PlanKey } from "@/lib/premium-plans";
import { usePremium } from "@/hooks/use-premium";
import { buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CrownMark } from "@/components/premium/crown";
import { cn } from "@/lib/utils";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

const PLAN_POINTS: Record<PlanKey, string[]> = {
  MONTHLY: ["Every Premium benefit", "Renew whenever you like", "Unused time is never lost on renewal"],
  YEARLY: ["Every Premium benefit", "Twelve months for the price of ten", "One payment, nothing to remember"],
};

/**
 * Buttons are plain links to /premium/checkout. That page is server-guarded:
 * a signed-out visitor is redirected to /login?next=… and lands back on
 * checkout after signing in, so the flow cannot be skipped from the browser.
 */
function PlanCard({ plan, renew, next }: { plan: PlanKey; renew: boolean; next: string | null }) {
  const p = PLANS[plan];
  const highlighted = plan === "YEARLY";
  return (
    <div
      className={cn(
        "glass-card relative flex flex-col rounded-panel p-6 sm:p-7",
        highlighted && "edge-gold lg:-translate-y-2"
      )}
    >
      {p.badge && (
        <span className="gold-sheen absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap text-accent-foreground shadow-gold">
          {p.badge}
        </span>
      )}
      <div className="flex items-center gap-3">
        {highlighted ? <CrownMark size="sm" /> : <Crown className="h-5 w-5 text-gold-ink" aria-hidden />}
        <h3 className="text-subheading">{p.name}</h3>
      </div>
      <p className="mt-5 flex items-baseline gap-1.5">
        <span className="font-display text-5xl font-extrabold tracking-tight">${p.priceUsd}</span>
        <span className="text-muted-foreground">/ {p.periodLabel}</span>
      </p>
      {plan === "YEARLY" && (
        <p className="mt-1 text-sm text-muted-foreground">Works out to about $0.83 a month.</p>
      )}
      <ul className="mt-6 space-y-3 text-sm">
        {PLAN_POINTS[plan].map((point) => (
          <li key={point} className="flex items-start gap-2.5">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-ink" aria-hidden />
            {point}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-7">
        <Link
          href={`/premium/checkout?plan=${plan}${next ? `&next=${encodeURIComponent(next)}` : ""}`}
          className={cn(
            buttonClasses(highlighted ? "accent" : "outline", "lg", "w-full"),
            highlighted && "bg-gold shadow-gold hover:shadow-gold"
          )}
        >
          {renew ? <RefreshCw className="h-4 w-4" aria-hidden /> : <Crown className="h-4 w-4" aria-hidden />}
          {renew ? `Renew ${p.name.toLowerCase()}` : `Get ${p.name}`}
        </Link>
      </div>
    </div>
  );
}

export function SecureBadge({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-success/25 bg-success-soft px-3.5 py-1.5 text-xs font-semibold text-success",
        className
      )}
    >
      <ShieldCheck className="h-4 w-4" aria-hidden />
      Secure crypto payment via NOWPayments
    </p>
  );
}

const STATUS_LABEL: Record<string, { label: string; variant: "success" | "warning" | "destructive" }> = {
  FINISHED: { label: "Paid", variant: "success" },
  PARTIALLY_PAID: { label: "Partially paid", variant: "warning" },
  REFUNDED: { label: "Refunded", variant: "destructive" },
};

/**
 * The page a "Skip ads" button sent the visitor from (?next=). Read on the
 * client because /premium is static; checkout and the server re-validate it.
 */
function useReturnPath(): string | null {
  const [next, setNext] = React.useState<string | null>(null);
  React.useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("next");
    if (raw && /^\/download\/[a-z0-9][a-z0-9-]{0,190}$/.test(raw)) setNext(raw);
  }, []);
  return next;
}

/** Plans for visitors; plan, expiry, renew and history for members. */
export function PlansOrAccount() {
  const { loading, me } = usePremium();
  const next = useReturnPath();

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-96 rounded-panel" />
        <Skeleton className="h-96 rounded-panel" />
      </div>
    );
  }

  if (me.subscribed && me.premiumUntil) {
    const plan = me.plan ? PLANS[me.plan].name : "Premium";
    return (
      <div className="space-y-10">
        {next && (
          <Link href={next} className={cn(buttonClasses("accent", "lg", "w-full"), "bg-gold shadow-gold")}>
            <Zap className="h-4 w-4" aria-hidden /> You&apos;re Premium — open your direct link
          </Link>
        )}
        <div className="glass-card edge-gold flex flex-wrap items-center justify-between gap-6 rounded-panel p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <CrownMark size="lg" />
            <div>
              <p className="text-eyebrow text-gold-ink uppercase">Your membership</p>
              <p className="text-heading">{plan} plan</p>
              <p className="mt-1 text-muted-foreground">
                Active until <strong className="text-foreground">{DATE.format(new Date(me.premiumUntil))}</strong>
              </p>
            </div>
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            Renewing now adds the new period on top of your current expiry date, so you never lose
            the days you have left.
          </p>
        </div>

        <div>
          <h3 className="mb-6 text-subheading">Renew or extend</h3>
          <div className="grid gap-6 md:grid-cols-2">
            <PlanCard plan="MONTHLY" renew next={next} />
            <PlanCard plan="YEARLY" renew next={next} />
          </div>
        </div>

        <div>
          <h3 className="mb-4 flex items-center gap-2 text-subheading">
            <History className="h-5 w-5 text-muted-foreground" aria-hidden />
            Payment history
          </h3>
          {me.payments && me.payments.length > 0 ? (
            <div className="overflow-x-auto rounded-card border border-border bg-card">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                    <th className="p-3 font-medium">Date</th>
                    <th className="p-3 font-medium">Plan</th>
                    <th className="p-3 font-medium">Amount</th>
                    <th className="p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {me.payments.map((p) => {
                    const s = STATUS_LABEL[p.status] ?? { label: p.status, variant: "warning" as const };
                    return (
                      <tr key={p.id} className="border-b border-border last:border-0">
                        <td className="p-3 whitespace-nowrap">{DATE.format(new Date(p.createdAt))}</td>
                        <td className="p-3">{PLANS[p.plan]?.name ?? p.plan}</td>
                        <td className="p-3 numeric">
                          ${p.amount} <span className="text-muted-foreground uppercase">· {p.coin}</span>
                        </td>
                        <td className="p-3">
                          <Badge variant={s.variant}>{s.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No payments on record yet — your current Premium time was added by our team.
            </p>
          )}
        </div>
      </div>
    );
  }

  const expired = me.expiredAt ? DATE.format(new Date(me.expiredAt)) : null;
  return (
    <div className="space-y-8 lg:mx-auto lg:max-w-4xl">
      {expired && (
        <div className="flex flex-wrap items-center gap-4 rounded-panel border border-destructive/25 bg-destructive/5 p-5 sm:p-6">
          <Hourglass className="h-6 w-6 shrink-0 text-destructive" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              <Badge variant="destructive">Expired</Badge>
              Your Premium has expired – renew to keep access
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              It ended on {expired}. Pick a plan below to switch everything back on.
            </p>
          </div>
          <Link
            href={`/premium/checkout?plan=YEARLY${next ? `&next=${encodeURIComponent(next)}` : ""}`}
            className={cn(buttonClasses("accent", "md"), "bg-gold shadow-gold")}
          >
            <RefreshCw className="h-4 w-4" aria-hidden /> Renew Premium
          </Link>
        </div>
      )}
      {next && <ReturnNotice />}
      <div className="grid gap-6 md:grid-cols-2">
        <PlanCard plan="MONTHLY" renew={Boolean(expired)} next={next} />
        <PlanCard plan="YEARLY" renew={Boolean(expired)} next={next} />
      </div>
    </div>
  );
}

function ReturnNotice() {
  return (
    <p className="flex items-center justify-center gap-2 rounded-full border border-gold/30 bg-gold-soft px-4 py-2 text-center text-sm font-medium text-gold-ink">
      <Zap className="h-4 w-4 shrink-0" aria-hidden />
      Pick a plan — after payment you go straight to your direct link, no steps or ads.
    </p>
  );
}
