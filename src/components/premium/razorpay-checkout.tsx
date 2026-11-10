"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Check, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "@/lib/toast";
import { NO_REFUND_NOTICE, PLANS, PLAN_KEYS, type PlanKey } from "@/lib/premium-plans";
import { confirmRazorpayPaymentAction, createRazorpayOrderAction } from "@/server/actions/premium";
import { safeAction } from "@/lib/safe-action";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", cb: (resp: { error?: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let scriptPromise: Promise<boolean> | null = null;

/** Loads Razorpay Checkout once per page, on demand (never on page load). */
function loadCheckout(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  scriptPromise ??= new Promise<boolean>((resolve) => {
    const el = document.createElement("script");
    el.src = CHECKOUT_SRC;
    el.async = true;
    el.onload = () => resolve(Boolean(window.Razorpay));
    el.onerror = () => {
      scriptPromise = null;
      el.remove();
      resolve(false);
    };
    document.head.appendChild(el);
  });
  return scriptPromise;
}

export function RazorpayCheckout({
  initialPlan,
  prices,
  support,
  returnPath = null,
}: {
  initialPlan: PlanKey;
  /** "Skip ads" origin; re-validated by the success page before redirecting. */
  returnPath?: string | null;
  /** Computed on the server from the USD plan price; display only. */
  prices: Record<PlanKey, { label: string }> | null;
  support: { handle: string; url: string } | null;
}) {
  const router = useRouter();
  const [plan, setPlan] = React.useState<PlanKey>(initialPlan);
  const [agreed, setAgreed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  if (!prices) {
    return (
      <div className="flex items-start gap-3 rounded-card border border-warning/30 bg-warning-soft p-5 text-sm text-warning">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <p>UPI / card payments are temporarily unavailable. Please use crypto, or try again later.</p>
      </div>
    );
  }

  function fail(message: string) {
    setBusy(false);
    setError(message);
    toast.error(message);
  }

  async function pay() {
    if (!agreed || busy) return;
    setBusy(true);
    setError("");
    const [loaded, order] = await Promise.all([
      loadCheckout(),
      safeAction(() => createRazorpayOrderAction({ plan, agreed: true }), "razorpay order"),
    ]);
    if (!order.ok || !("orderId" in order)) return fail("error" in order && order.error ? order.error : "Something went wrong.");
    if (!loaded || !window.Razorpay) {
      return fail("The payment window couldn't load. Check your connection or disable any blocker for checkout.razorpay.com, then try again.");
    }

    const rzp = new window.Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: order.name,
      description: order.description,
      // Nothing personal is prefilled; Razorpay asks for what the method needs.
      theme: { color: "#d4a017" },
      modal: {
        ondismiss: () => setBusy(false),
        confirm_close: true,
      },
      handler: async (resp: RazorpaySuccess) => {
        // The browser's success message proves nothing on its own: the server
        // verifies the signature and asks Razorpay before anything activates.
        const res = await safeAction(
          () =>
            confirmRazorpayPaymentAction({
              orderId: resp.razorpay_order_id,
              paymentId: resp.razorpay_payment_id,
              signature: resp.razorpay_signature,
            }),
          "razorpay confirm"
        );
        if (res.ok) {
          const next = returnPath ? `&next=${encodeURIComponent(returnPath)}` : "";
          router.push(`/premium/success?rzp=${encodeURIComponent(order.orderId)}${next}`);
          return;
        }
        fail("error" in res && res.error ? res.error : "We couldn't verify this payment.");
      },
    });
    rzp.on("payment.failed", (resp) => {
      // Razorpay keeps its window open so the buyer can retry another method.
      const reason = resp?.error?.description;
      setError(reason ? `Payment failed: ${reason}. You can try again in the payment window.` : "Payment failed. You can try again in the payment window.");
    });
    rzp.open();
  }

  const price = prices[plan];

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
                onClick={() => {
                  setPlan(key);
                  setError("");
                }}
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
                  {prices[key].label}
                  <span className="text-sm font-normal text-muted-foreground"> / {p.periodLabel}</span>
                </span>
                <span className="block text-xs text-muted-foreground">${p.priceUsd} USD</span>
                {p.badge && <span className="mt-1 block text-xs font-semibold text-gold-ink">{p.badge}</span>}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="rounded-card border border-border bg-muted/30 p-4 text-sm">
        <p className="font-semibold">2. Review</p>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5">
          <dt className="text-muted-foreground">Plan</dt>
          <dd>Premium {PLANS[plan].name} (1 {PLANS[plan].periodLabel})</dd>
          <dt className="text-muted-foreground">Price</dt>
          <dd className="numeric">
            <strong>{price.label}</strong> <span className="text-muted-foreground">(${PLANS[plan].priceUsd} USD)</span>
          </dd>
          <dt className="text-muted-foreground">Pay with</dt>
          <dd>UPI, debit/credit card or netbanking</dd>
        </dl>
        <p className="mt-4 rounded-control border border-warning/30 bg-warning-soft px-3 py-2 font-medium text-warning">
          {NO_REFUND_NOTICE}
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          required
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--gold,#d4a017)]"
        />
        <span>
          I agree to the{" "}
          <Link href="/terms" target="_blank" className="font-medium text-primary underline underline-offset-2">
            Terms
          </Link>{" "}
          and the{" "}
          <Link href="/refund-policy" target="_blank" className="font-medium text-primary underline underline-offset-2">
            No Refund Policy
          </Link>
          .
        </span>
      </label>

      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <Button size="lg" variant="accent" className="bg-gold w-full shadow-gold" disabled={!agreed || busy} onClick={pay}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowRight className="h-4 w-4" aria-hidden />}
        {agreed ? `Pay ${price.label} with UPI / Card` : "Accept the Terms to continue"}
      </Button>
      <p className="-mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        Processed securely by Razorpay. We never see or store your card or UPI details.
      </p>
      {support && (
        <p className="text-center text-sm text-muted-foreground">
          Questions before you pay? Message{" "}
          <a href={support.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2">
            {support.handle}
          </a>{" "}
          on Telegram.
        </p>
      )}
    </div>
  );
}
