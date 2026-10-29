/**
 * Premium plan catalogue. Client-safe (no server imports) so the sales page
 * and the bot render the same numbers the server charges.
 *
 * The server never takes a price from a request: checkout looks the plan up
 * here by its key and charges `priceUsd`, and the IPN handler compares what
 * NOWPayments reports against the amount stored on our own Payment row.
 */

export type PlanKey = "MONTHLY" | "YEARLY";

export interface PlanDefinition {
  key: PlanKey;
  name: string;
  priceUsd: number;
  /** Length of one period, in calendar units. */
  months: number;
  periodLabel: string;
  badge?: string;
}

export const PLANS: Record<PlanKey, PlanDefinition> = {
  MONTHLY: {
    key: "MONTHLY",
    name: "Monthly",
    priceUsd: 1,
    months: 1,
    periodLabel: "month",
  },
  YEARLY: {
    key: "YEARLY",
    name: "Yearly",
    priceUsd: 10,
    months: 12,
    periodLabel: "year",
    // 12 x $1 = $12 against $10: (12 - 10) / 12 = 16.7%, shown as 17%.
    badge: "Best Value – Save 17%",
  },
};

export const PLAN_KEYS: readonly PlanKey[] = ["MONTHLY", "YEARLY"];

export function isPlanKey(value: unknown): value is PlanKey {
  return value === "MONTHLY" || value === "YEARLY";
}

/**
 * Razorpay charges in INR. The INR price is derived from the USD price above
 * at the fixed RAZORPAY_USD_INR_RATE (read on the server; see
 * src/lib/razorpay-config.ts) — never kept as a second price list, so the two
 * can't drift. Integer maths only: whole cents x rate, rounded once to paise.
 */
export function inrPaise(priceUsd: number, usdInrRate: number): number {
  return Math.round(Math.round(priceUsd * 100) * usdInrRate);
}

/** "₹1,000" or "₹99.50" — whole rupees drop the decimals. */
export function formatInr(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Shown before every payment, on the site, in the bot and at checkout. */
export const NO_REFUND_NOTICE = "Digital product. All sales are final. No refunds.";
