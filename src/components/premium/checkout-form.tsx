"use client";

import * as React from "react";
import { AlertCircle, ArrowRight, Check, Coins, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PLANS, PLAN_KEYS, type PlanKey } from "@/lib/premium-plans";
import { createCheckoutAction } from "@/server/actions/premium";
import { safeAction } from "@/lib/safe-action";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CheckoutCoin {
  ticker: string;
  label: string;
  network: string;
  minUsd: number | null;
  available: Record<PlanKey, boolean>;
}

export function CheckoutForm({
  initialPlan,
  coins,
  configured,
}: {
  initialPlan: PlanKey;
  coins: CheckoutCoin[];
  configured: boolean;
}) {
  const [plan, setPlan] = React.useState<PlanKey>(initialPlan);
  const firstAvailable = (p: PlanKey) => coins.find((c) => c.available[p])?.ticker ?? "";
  const [coin, setCoin] = React.useState(() => firstAvailable(initialPlan));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  function choosePlan(p: PlanKey) {
    setPlan(p);
    setError("");
    if (!coins.find((c) => c.ticker === coin)?.available[p]) setCoin(firstAvailable(p));
  }

  async function pay() {
    if (!coin) return;
    setBusy(true);
    setError("");
    const res = await safeAction(() => createCheckoutAction(plan, coin), "checkout");
    if (res.ok && "invoiceUrl" in res) {
      // Hand off to the provider's hosted page; it returns to /premium/success.
      window.location.assign(res.invoiceUrl);
      return;
    }
    setBusy(false);
    const message = "error" in res ? res.error : "Something went wrong.";
    setError(message);
    toast.error(message);
  }

  if (!configured || coins.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-card border border-warning/30 bg-warning-soft p-5 text-sm text-warning">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <p>
          Crypto checkout is temporarily unavailable. Please try again in a few minutes, or contact
          Premium Purchase Support to pay another way.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <fieldset>
        <legend className="mb-3 text-sm font-semibold">1. Plan</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {PLAN_KEYS.map((key) => {
            const p = PLANS[key];
            const active = plan === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => choosePlan(key)}
                className={cn(
                  "glass-card relative rounded-card p-4 text-left transition-[border-color,box-shadow] duration-300",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "edge-gold" : "hover:border-primary/40"
                )}
              >
                <span className="flex items-center justify-between">
                  <span className="font-semibold">{p.name}</span>
                  {active && <Check className="h-4 w-4 text-gold-ink" aria-hidden />}
                </span>
                <span className="mt-1 block text-2xl font-extrabold">
                  ${p.priceUsd}
                  <span className="text-sm font-normal text-muted-foreground"> / {p.periodLabel}</span>
                </span>
                {p.badge && <span className="mt-1 block text-xs font-semibold text-gold-ink">{p.badge}</span>}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-sm font-semibold">2. Coin</legend>
        <div className="grid gap-2.5">
          {coins.map((c) => {
            const ok = c.available[plan];
            const active = coin === c.ticker;
            return (
              <button
                key={c.ticker}
                type="button"
                disabled={!ok}
                aria-pressed={active}
                onClick={() => setCoin(c.ticker)}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-control border p-3.5 text-left text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  ok ? "cursor-pointer bg-card hover:border-primary/40" : "cursor-not-allowed bg-muted/40 opacity-70",
                  active ? "border-gold/60 bg-gold-soft/40" : "border-border"
                )}
              >
                <span className="flex items-center gap-3">
                  <Coins className="h-4.5 w-4.5 text-muted-foreground" aria-hidden />
                  <span>
                    <span className="font-semibold">{c.label}</span>
                    <span className="text-muted-foreground"> · {c.network}</span>
                    {!ok && (
                      <span className="mt-0.5 block text-xs text-warning">
                        Not available for ${PLANS[plan].priceUsd}
                        {c.minUsd !== null ? ` — this coin's minimum is about $${c.minUsd.toFixed(2)}` : ""}
                      </span>
                    )}
                  </span>
                </span>
                {active && ok && <Check className="h-4 w-4 shrink-0 text-gold-ink" aria-hidden />}
              </button>
            );
          })}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <Button
        size="lg"
        variant="accent"
        className="bg-gold w-full shadow-gold"
        disabled={!coin || busy}
        onClick={pay}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowRight className="h-4 w-4" aria-hidden />}
        Pay ${PLANS[plan].priceUsd} with crypto
      </Button>
    </div>
  );
}
