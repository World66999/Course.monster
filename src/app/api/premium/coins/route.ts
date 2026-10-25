import type { NextRequest } from "next/server";
import { coinCatalog, coinsForPrice, isConfigured } from "@/lib/nowpayments";
import { MIN_SEARCH_LENGTH, normalizeQuery, POPULAR_COINS, searchCoins, toCheckoutCoin } from "@/lib/coins";
import { PLANS, isPlanKey } from "@/lib/premium-plans";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/ip";
import { getViewer, jsonNoStore } from "@/server/premium-guard";

/**
 * Checkout coin search: `?plan=MONTHLY&q=doge`.
 *
 * Searches the account's NOWPayments catalogue (minus the popular coins the
 * page already shows) and returns only coins whose live minimum fits that
 * plan's price — a coin that can't be used is never sent to the browser.
 * Signed-in only, since only the checkout uses it and each uncached result
 * costs a NOWPayments call.
 */
export const dynamic = "force-dynamic";

/** Matches checked per search; the best that fit are returned. */
const CANDIDATES = 40;
const RESULTS = 20;
const POPULAR = new Set<string>(POPULAR_COINS);

export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return jsonNoStore({ error: "Please sign in." }, { status: 401 });

  const ipKey = hashIp(await getClientIp());
  if (
    !checkRateLimit(`coin-search:${viewer.id}`, { limit: 60, windowMs: 60_000 }).ok ||
    !checkRateLimit(`coin-search-ip:${ipKey}`, { limit: 120, windowMs: 60_000 }).ok
  ) {
    return jsonNoStore({ error: "Too many searches. Please wait a moment." }, { status: 429 });
  }

  const params = request.nextUrl.searchParams;
  const planKey = params.get("plan");
  if (!isPlanKey(planKey)) return jsonNoStore({ error: "Unknown plan." }, { status: 400 });
  const q = normalizeQuery(params.get("q") ?? "");
  if (q.length < MIN_SEARCH_LENGTH || !isConfigured()) return jsonNoStore({ coins: [] });

  const catalog = (await coinCatalog()).filter((c) => !POPULAR.has(c.ticker));
  const matches = searchCoins(catalog, q, CANDIDATES);
  const usable = await coinsForPrice(matches, PLANS[planKey].priceUsd);
  return jsonNoStore({ coins: usable.slice(0, RESULTS).map(toCheckoutCoin) });
}
