import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getViewer } from "@/server/premium-guard";
import { availableCoins, coinSupportsPrice, isConfigured } from "@/lib/nowpayments";
import { PLANS, isPlanKey, type PlanKey } from "@/lib/premium-plans";
import { Section } from "@/components/site/section";
import { CheckoutForm, type CheckoutCoin } from "@/components/premium/checkout-form";
import { SecureBadge } from "@/components/premium/plan-cards";

export const metadata: Metadata = { title: "Checkout — Premium", robots: { index: false } };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CheckoutPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const planParam = Array.isArray(raw.plan) ? raw.plan[0] : raw.plan;
  const plan: PlanKey = isPlanKey(planParam) ? planParam : "YEARLY";

  // Logged out -> sign in, then straight back here with the same plan.
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(`/premium/checkout?plan=${plan}`)}`);

  const configured = isConfigured();
  const coins = configured ? await availableCoins() : [];
  const options: CheckoutCoin[] = coins.map((c) => ({
    ticker: c.ticker,
    label: c.label,
    network: c.network,
    minUsd: c.minUsd,
    available: { MONTHLY: coinSupportsPrice(c, PLANS.MONTHLY.priceUsd), YEARLY: coinSupportsPrice(c, PLANS.YEARLY.priceUsd) },
  }));

  return (
    <Section className="max-w-2xl py-12 sm:py-16">
      <Link
        href="/premium"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to Premium
      </Link>
      <h1 className="text-title">Checkout</h1>
      <p className="mt-2 text-muted-foreground">
        Choose your plan and a coin. You&apos;ll pay on NOWPayments&apos; secure hosted page, and Premium
        activates automatically once the payment is confirmed.
      </p>
      {viewer.premium && viewer.premiumUntil && viewer.premiumUntil.getTime() > Date.now() && (
        <p className="mt-4 rounded-nested border border-gold/30 bg-gold-soft p-3 text-sm text-gold-ink">
          You&apos;re already Premium. This payment adds a new period on top of your current expiry.
        </p>
      )}
      <div className="mt-8">
        <CheckoutForm initialPlan={plan} coins={options} configured={configured} />
      </div>
      <div className="mt-8 flex justify-center">
        <SecureBadge />
      </div>
    </Section>
  );
}
