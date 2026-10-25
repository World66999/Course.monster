import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getViewer } from "@/server/premium-guard";
import { coinsForPrice, isConfigured, popularCatalogCoins } from "@/lib/nowpayments";
import { toCheckoutCoin, type CheckoutCoin } from "@/lib/coins";
import { PLANS, isPlanKey, type PlanKey } from "@/lib/premium-plans";
import { safeReturnPath } from "@/lib/return-path";
import { Section } from "@/components/site/section";
import { CheckoutForm } from "@/components/premium/checkout-form";
import { SecureBadge } from "@/components/premium/plan-cards";

export const metadata: Metadata = { title: "Checkout — Premium", robots: { index: false } };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CheckoutPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const planParam = Array.isArray(raw.plan) ? raw.plan[0] : raw.plan;
  const plan: PlanKey = isPlanKey(planParam) ? planParam : "YEARLY";
  // The page a "Skip ads" click came from; buyers go back there once paid.
  const next = safeReturnPath(Array.isArray(raw.next) ? raw.next[0] : raw.next);
  const self = `/premium/checkout?plan=${plan}${next ? `&next=${encodeURIComponent(next)}` : ""}`;

  // Logged out -> sign in, then straight back here with the same plan.
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(self)}`);

  const configured = isConfigured();
  // Each plan gets its own list: only popular coins whose live minimum fits
  // that plan's price are sent to the browser. Minimums are cached, so the
  // second plan reuses the first plan's lookups.
  const popular = configured ? await popularCatalogCoins() : [];
  const [monthly, yearly] = await Promise.all([
    coinsForPrice(popular, PLANS.MONTHLY.priceUsd),
    coinsForPrice(popular, PLANS.YEARLY.priceUsd),
  ]);
  const coinsByPlan: Record<PlanKey, CheckoutCoin[]> = {
    MONTHLY: monthly.map(toCheckoutCoin),
    YEARLY: yearly.map(toCheckoutCoin),
  };

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
      {next && (
        <p className="mt-4 rounded-nested border border-primary/20 bg-primary/5 p-3 text-sm">
          After payment you&apos;ll go straight to the direct link you were opening — no steps, no ads.
        </p>
      )}
      {viewer.premium && viewer.premiumUntil && viewer.premiumUntil.getTime() > Date.now() && (
        <p className="mt-4 rounded-nested border border-gold/30 bg-gold-soft p-3 text-sm text-gold-ink">
          You&apos;re already Premium. This payment adds a new period on top of your current expiry.
        </p>
      )}
      <div className="mt-8">
        <CheckoutForm initialPlan={plan} coinsByPlan={coinsByPlan} configured={configured} returnPath={next} />
      </div>
      <div className="mt-8 flex justify-center">
        <SecureBadge />
      </div>
    </Section>
  );
}
