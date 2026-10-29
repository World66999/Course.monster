"use client";

import * as React from "react";
import { Bitcoin, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

export type PaymentMethod = "razorpay" | "crypto";

/**
 * Switches between the two checkouts. Both forms stay mounted (just hidden),
 * so switching back and forth keeps what the buyer already picked.
 */
export function PaymentMethodTabs({
  initial,
  razorpay,
  crypto,
}: {
  initial: PaymentMethod;
  razorpay: React.ReactNode;
  crypto: React.ReactNode;
}) {
  const [method, setMethod] = React.useState<PaymentMethod>(initial);
  const tabs: { key: PaymentMethod; label: string; hint: string; icon: typeof CreditCard }[] = [
    { key: "razorpay", label: "UPI / Card", hint: "UPI, cards, netbanking · INR", icon: CreditCard },
    { key: "crypto", label: "Crypto", hint: "USDT, LTC, SOL and more · USD", icon: Bitcoin },
  ];
  return (
    <div className="space-y-8">
      <div role="tablist" aria-label="Payment method" className="grid gap-3 sm:grid-cols-2">
        {tabs.map(({ key, label, hint, icon: Icon }) => {
          const active = method === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`pm-tab-${key}`}
              aria-selected={active}
              aria-controls={`pm-panel-${key}`}
              onClick={() => setMethod(key)}
              className={cn(
                "flex min-h-16 items-center gap-3 rounded-card border bg-card p-4 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-gold/60 bg-gold-soft/40" : "border-border hover:border-primary/40"
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", active ? "text-gold-ink" : "text-muted-foreground")} aria-hidden />
              <span className="min-w-0">
                <span className="block font-semibold">{label}</span>
                <span className="block text-xs text-muted-foreground">{hint}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id="pm-panel-razorpay" aria-labelledby="pm-tab-razorpay" hidden={method !== "razorpay"}>
        {razorpay}
      </div>
      <div role="tabpanel" id="pm-panel-crypto" aria-labelledby="pm-tab-crypto" hidden={method !== "crypto"}>
        {crypto}
      </div>
    </div>
  );
}
