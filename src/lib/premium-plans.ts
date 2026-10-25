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

/** Coins a checkout may offer, before the live minimum-amount check narrows them. */
export interface CoinOption {
  ticker: string;
  label: string;
  network: string;
}

export const COIN_LABELS: Record<string, Omit<CoinOption, "ticker">> = {
  usdttrc20: { label: "USDT", network: "TRON (TRC20)" },
  usdtbsc: { label: "USDT", network: "BNB Smart Chain (BEP20)" },
  ltc: { label: "Litecoin", network: "Litecoin" },
  trx: { label: "TRON", network: "TRON" },
  usdcbsc: { label: "USDC", network: "BNB Smart Chain (BEP20)" },
  usdtmatic: { label: "USDT", network: "Polygon" },
};
