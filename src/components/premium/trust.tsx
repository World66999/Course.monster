import { Bitcoin, CalendarX, CreditCard, Landmark, ShieldCheck, Smartphone, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Trust signals for Premium checkout. Every line is a fact about how payment
 * works here — no ratings, user counts or timers.
 */

const METHODS = [
  { icon: Smartphone, label: "UPI", inr: true },
  { icon: CreditCard, label: "Cards", inr: true },
  { icon: Landmark, label: "Netbanking", inr: true },
  { icon: Bitcoin, label: "Crypto", inr: false },
] as const;

/** The ways to pay, as badges. UPI, cards and netbanking only show when INR checkout is on. */
export function PaymentBadges({ inr = true, className }: { inr?: boolean; className?: string }) {
  return (
    <ul aria-label="Accepted payment methods" className={cn("flex flex-wrap items-center justify-center gap-2", className)}>
      {METHODS.filter((m) => inr || !m.inr).map(({ icon: Icon, label }) => (
        <li
          key={label}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-sm font-semibold text-foreground shadow-soft"
        >
          <Icon className="h-4 w-4 text-primary" aria-hidden />
          {label}
        </li>
      ))}
    </ul>
  );
}

const POINTS = [
  { icon: ShieldCheck, title: "Secure checkout", body: "Razorpay and NOWPayments handle the payment. We never see or store your card, UPI or wallet details." },
  { icon: Zap, title: "Activates automatically", body: "Premium switches on by itself as soon as the payment is confirmed." },
  { icon: CalendarX, title: "One-off payment", body: "Nothing renews on its own and nothing is charged without you." },
] as const;

/** Three short reassurances, for under the plans and beside the pay button. */
export function TrustPoints({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <ul className={cn("grid gap-3", compact ? "sm:grid-cols-1" : "sm:grid-cols-3", className)}>
      {POINTS.map(({ icon: Icon, title, body }) => (
        <li key={title} className="flex items-start gap-3 rounded-card border border-border bg-card/60 p-4 text-left">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-nested bg-success-soft text-success">
            <Icon className="h-4.5 w-4.5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{title}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{body}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
