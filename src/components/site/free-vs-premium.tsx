import Link from "next/link";
import { ArrowRight, Check, Crown, Gift } from "lucide-react";
import { NO_REFUND_NOTICE, PLANS, formatInr } from "@/lib/premium-plans";
import { inrPricesSafe } from "@/lib/razorpay-config";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Free vs Premium, side by side, for the home page. Every figure is read from
 * the same place the checkout uses (plan prices, the fixed rupee prices, the
 * admin's daily limit), so this block cannot drift from what is charged.
 */
export function FreeVsPremium({ freeLimit, className }: { freeLimit: number; className?: string }) {
  const inr = inrPricesSafe();
  const free = [
    `${freeLimit} course unlocks every day`,
    "One short verification link per unlock",
    "Every free course in the library",
    "No account or sign-in needed",
  ];
  const premium = [
    "Instant downloads: no links, no timers, no ads",
    "Unlimited courses, every day",
    "Premium-only courses and Premium Resources",
    "Private Telegram groups and priority support",
  ];
  return (
    <div className={cn("grid gap-4 lg:grid-cols-2", className)}>
      <div className="surface flex flex-col rounded-feature p-6 sm:p-8">
        <p className="inline-flex items-center gap-2 text-eyebrow text-primary uppercase">
          <Gift className="h-4 w-4" aria-hidden /> Free
        </p>
        <p className="font-display mt-3 text-4xl font-extrabold tracking-tight">
          ₹0 <span className="text-base font-medium text-muted-foreground">forever</span>
        </p>
        <ul className="mt-6 flex-1 space-y-3 text-sm">
          {free.map((line) => (
            <li key={line} className="flex items-start gap-2.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <Link href="/courses" className={buttonClasses("outline", "lg", "mt-8 w-full")}>
          Browse free courses
        </Link>
      </div>

      <div className="glass-card edge-gold relative flex flex-col overflow-hidden rounded-feature p-6 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(26rem_14rem_at_100%_0%,var(--wash-4),transparent_70%)]"
        />
        <div className="relative flex flex-1 flex-col">
          <p className="inline-flex items-center gap-2 text-eyebrow text-gold-ink uppercase">
            <Crown className="h-4 w-4" aria-hidden /> Premium
          </p>
          <p className="font-display mt-3 text-4xl font-extrabold tracking-tight">
            {inr ? inr.MONTHLY.label : `$${PLANS.MONTHLY.priceUsd}`}{" "}
            <span className="text-base font-medium text-muted-foreground">
              a month{inr ? ` ($${PLANS.MONTHLY.priceUsd})` : ""}
            </span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            or {inr ? `${inr.YEARLY.label} ($${PLANS.YEARLY.priceUsd})` : `$${PLANS.YEARLY.priceUsd}`} for a full year
            {inr ? `, about ${formatInr(Math.round(inr.YEARLY.paise / 12 / 100) * 100)} a month` : ""}
          </p>
          <ul className="mt-6 flex-1 space-y-3 text-sm">
            {premium.map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-ink" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/premium#plans"
            className="group mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gold px-6 font-semibold text-accent-foreground shadow-gold transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            See Premium plans
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            UPI, card or crypto · one-off payment, nothing renews by itself
            <br />
            {NO_REFUND_NOTICE}
          </p>
        </div>
      </div>
    </div>
  );
}
