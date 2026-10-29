import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { getViewer } from "@/server/premium-guard";
import { PLANS } from "@/lib/premium-plans";
import { safeReturnPath } from "@/lib/return-path";
import { Section } from "@/components/site/section";
import { buttonClasses } from "@/components/ui/button";
import { CrownMark } from "@/components/premium/crown";
import { AutoRefresh } from "@/components/premium/auto-refresh";

export const metadata: Metadata = { title: "Payment status — Premium", robots: { index: false } };
export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/**
 * Where NOWPayments sends the buyer back. Arriving here proves nothing — the
 * page only *reports* what the signed IPN has already recorded for this
 * user's own order, and polls until it lands.
 */
export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ order?: string; rzp?: string; next?: string }> }) {
  const { order, rzp, next } = await searchParams;
  const viewer = await getViewer();
  if (!viewer) {
    const back = typeof rzp === "string" ? `/premium/success?rzp=${encodeURIComponent(rzp)}` : `/premium/success?order=${encodeURIComponent(order ?? "")}`;
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }
  if (typeof rzp === "string") return <RazorpayStatus orderId={rzp} userId={viewer.id} next={safeReturnPath(next ?? null)} premium={viewer.premium} />;

  const payment =
    typeof order === "string" && order.length <= 100
      ? await db.payment.findFirst({
          where: { orderId: order, userId: viewer.id },
          select: { status: true, plan: true, returnPath: true, subscription: { select: { expiresAt: true } } },
        })
      : null;

  if (!payment) {
    return (
      <Section className="max-w-xl py-16 text-center">
        <h1 className="text-heading">We couldn&apos;t find that order</h1>
        <p className="mt-3 text-muted-foreground">It may belong to another account. Check your Premium page for your status.</p>
        <Link href="/premium" className={buttonClasses("primary", "md", "mt-6")}>Go to Premium</Link>
      </Section>
    );
  }

  if (payment.status === "FINISHED") {
    // Came from "Skip ads": straight back to that page, which now hands a
    // member the direct link without steps.
    const back = safeReturnPath(payment.returnPath);
    if (back && viewer.premium) redirect(back);
    return (
      <Section className="max-w-xl py-16 text-center">
        <div className="flex justify-center"><CrownMark size="lg" /></div>
        <h1 className="mt-6 text-title">Welcome to <span className="text-gold-gradient">Premium</span></h1>
        <p className="mt-4 flex items-center justify-center gap-2 text-success">
          <CheckCircle2 className="h-5 w-5" aria-hidden /> Payment confirmed — {PLANS[payment.plan].name} plan
        </p>
        {payment.subscription && (
          <p className="mt-2 text-muted-foreground">Active until {DATE.format(payment.subscription.expiresAt)}.</p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/premium-resources" className={buttonClasses("accent", "lg", "bg-gold shadow-gold")}>Open Premium Resources</Link>
          <Link href="/courses" className={buttonClasses("outline", "lg")}>Browse courses</Link>
        </div>
      </Section>
    );
  }

  const failed = ["FAILED", "EXPIRED", "REFUNDED"].includes(payment.status);
  const partial = payment.status === "PARTIALLY_PAID";
  return (
    <Section className="max-w-xl py-16 text-center">
      {!failed && !partial && <AutoRefresh everyMs={6000} maxTries={60} />}
      <div className="flex justify-center">
        {failed ? <XCircle className="h-12 w-12 text-destructive" aria-hidden /> : <Clock3 className="h-12 w-12 text-gold-ink" aria-hidden />}
      </div>
      <h1 className="mt-5 text-heading">
        {failed ? "This payment didn't go through" : partial ? "Payment incomplete" : "Waiting for confirmation"}
      </h1>
      <p className="mt-3 text-muted-foreground">
        {failed
          ? "The invoice expired or the payment failed. Nothing was activated. You can start a new checkout any time."
          : partial
            ? "We received less than the invoice amount, so Premium isn't active yet. Open a support ticket and we'll sort it out."
            : "Blockchain confirmations usually take a few minutes. This page updates by itself — you can also close it; Premium activates either way."}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {failed && <Link href="/premium#plans" className={buttonClasses("primary", "md")}>Try again</Link>}
        {(partial || failed) && <Link href="/premium/support" className={buttonClasses("outline", "md")}>Contact support</Link>}
      </div>
    </Section>
  );
}

/**
 * Razorpay return. Like the crypto flow, this only reports what the server
 * has already verified (signature + Razorpay API, or the signed webhook) for
 * the viewer's own order; it never activates anything itself.
 */
async function RazorpayStatus({
  orderId,
  userId,
  next,
  premium,
}: {
  orderId: string;
  userId: string;
  next: string | null;
  premium: boolean;
}) {
  const row = /^order_[A-Za-z0-9]{6,40}$/.test(orderId)
    ? await db.razorpayPayment.findFirst({
        where: { orderId, userId },
        select: { status: true, plan: true, fulfilledAt: true, subscription: { select: { expiresAt: true } } },
      })
    : null;

  if (!row) {
    return (
      <Section className="max-w-xl py-16 text-center">
        <h1 className="text-heading">We couldn&apos;t find that order</h1>
        <p className="mt-3 text-muted-foreground">It may belong to another account. Check your Premium page for your status.</p>
        <Link href="/premium" className={buttonClasses("primary", "md", "mt-6")}>Go to Premium</Link>
      </Section>
    );
  }

  if (row.status === "PAID" && row.fulfilledAt) {
    // Came from "Skip ads": straight back to that page.
    if (next && premium) redirect(next);
    return (
      <Section className="max-w-xl py-16 text-center">
        <div className="flex justify-center"><CrownMark size="lg" /></div>
        <h1 className="mt-6 text-title">Welcome to <span className="text-gold-gradient">Premium</span></h1>
        <p className="mt-4 flex items-center justify-center gap-2 text-success">
          <CheckCircle2 className="h-5 w-5" aria-hidden /> Payment confirmed — {PLANS[row.plan].name} plan
        </p>
        {row.subscription && (
          <p className="mt-2 text-muted-foreground">Active until {DATE.format(row.subscription.expiresAt)}.</p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/premium-resources" className={buttonClasses("accent", "lg", "bg-gold shadow-gold")}>Open Premium Resources</Link>
          <Link href="/courses" className={buttonClasses("outline", "lg")}>Browse courses</Link>
        </div>
      </Section>
    );
  }

  const flagged = row.status === "FLAGGED";
  const waiting = row.status === "PENDING" || row.status === "EXPIRED";
  return (
    <Section className="max-w-xl py-16 text-center">
      {waiting && <AutoRefresh everyMs={4000} maxTries={45} />}
      <div className="flex justify-center">
        {waiting ? <Clock3 className="h-12 w-12 text-gold-ink" aria-hidden /> : <XCircle className="h-12 w-12 text-destructive" aria-hidden />}
      </div>
      <h1 className="mt-5 text-heading">
        {waiting ? "Confirming your payment" : flagged ? "Payment under review" : "This payment didn't go through"}
      </h1>
      <p className="mt-3 text-muted-foreground">
        {waiting
          ? "We're confirming your payment with Razorpay. This usually takes a few seconds and this page updates by itself. If you closed the payment window without paying, nothing was charged."
          : flagged
            ? "We couldn't confirm this payment automatically, so Premium isn't active yet. Our team has been notified and will review it — contact support with your payment ID if you need help."
            : "Nothing was activated. You can start a new checkout any time."}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {!waiting && !flagged && <Link href="/premium/checkout" className={buttonClasses("primary", "md")}>Try again</Link>}
        <Link href="/contact" className={buttonClasses("outline", "md")}>Contact support</Link>
      </div>
    </Section>
  );
}
