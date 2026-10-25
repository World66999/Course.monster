import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { COIN_LABELS, type CoinOption } from "@/lib/premium-plans";

/**
 * NOWPayments client (server only).
 *
 * The API key and IPN secret are read from the environment on every use and
 * are never logged, returned, or put in a URL. `server-only` makes a client
 * import a build error rather than a leak.
 */

const REQUEST_TIMEOUT_MS = 10_000;

export function apiBase(): string {
  // Overridable so tests can point the client at a local mock; same trust
  // level as the key itself (server env only).
  return (process.env.NOWPAYMENTS_API_BASE || "https://api.nowpayments.io/v1").replace(/\/+$/, "");
}

function apiKey(): string {
  const k = process.env.NOWPAYMENTS_API_KEY;
  if (!k) throw new Error("NOWPAYMENTS_API_KEY is not set");
  return k;
}

export function isConfigured(): boolean {
  return Boolean(process.env.NOWPAYMENTS_API_KEY && process.env.NOWPAYMENTS_IPN_SECRET);
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: {
      "x-api-key": apiKey(),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    // fall through to the status check
  }
  if (!res.ok) {
    // Only the provider's own message, truncated. Never the request headers.
    const msg = (json as { message?: string } | null)?.message ?? `HTTP ${res.status}`;
    throw new Error(`NOWPayments ${path.split("?")[0]} failed: ${String(msg).slice(0, 200)}`);
  }
  return json as T;
}

// ---------------------------------------------------------------------------
// Coins and minimum amounts
// ---------------------------------------------------------------------------

/**
 * Low-fee coins we are willing to offer. A $1 invoice is below the minimum for
 * many coins (BTC, ETH and most ERC-20 tokens), so this is only a candidate
 * list: each coin is checked live against /min-amount before it is shown, and
 * dropped if the provider says the price would not clear its minimum.
 * Overridable with NOWPAYMENTS_COINS (comma-separated tickers).
 *
 * Checked 2026-10-24: USDT-BSC, LTC, TRX, USDC-BSC and USDT-Polygon all had
 * minimums well under $1, while USDT-TRC20 was ~$11 — above even the yearly
 * price. TRC20 stays on the list so the checkout can say plainly that it is
 * unavailable rather than silently hiding a coin people ask for.
 */
export function candidateCoins(): string[] {
  const raw = process.env.NOWPAYMENTS_COINS || "usdtbsc,ltc,trx,usdcbsc,usdtmatic,usdttrc20";
  return raw
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter((c) => /^[a-z0-9]{2,20}$/.test(c));
}

interface MinAmountResponse {
  currency_from: string;
  currency_to: string;
  min_amount: number;
  fiat_equivalent?: number;
}

export interface CoinAvailability extends CoinOption {
  /** Smallest invoice in USD this coin accepts, per the provider. */
  minUsd: number | null;
}

/**
 * Safety margin over the provider's minimum. Network fees and rate movement
 * between invoice and payment can push a borderline amount under the line,
 * which turns into a partially_paid payment the user has to chase.
 */
const MIN_MARGIN = 0.85;

let coinCache: { at: number; coins: CoinAvailability[] } | null = null;
const COIN_CACHE_MS = 10 * 60 * 1000;

export async function availableCoins(force = false): Promise<CoinAvailability[]> {
  if (!force && coinCache && Date.now() - coinCache.at < COIN_CACHE_MS) return coinCache.coins;

  const results = await Promise.all(
    candidateCoins().map(async (ticker): Promise<CoinAvailability | null> => {
      try {
        const res = await call<MinAmountResponse>(
          "GET",
          `/min-amount?currency_from=${ticker}&currency_to=${ticker}&fiat_equivalent=usd&is_fee_paid_by_user=false`
        );
        const minUsd = typeof res.fiat_equivalent === "number" ? res.fiat_equivalent : null;
        const meta = COIN_LABELS[ticker] ?? { label: ticker.toUpperCase(), network: "" };
        return { ticker, ...meta, minUsd };
      } catch (err) {
        console.warn(`[nowpayments] min-amount check failed for ${ticker}:`, err instanceof Error ? err.message : err);
        return null;
      }
    })
  );
  const coins = results.filter((c): c is CoinAvailability => c !== null);
  // Only cache a useful answer; an outage should be retried on the next view.
  if (coins.length > 0) coinCache = { at: Date.now(), coins };
  return coins;
}

/** True when `coin` can take an invoice of `priceUsd` with margin to spare. */
export function coinSupportsPrice(coin: CoinAvailability, priceUsd: number): boolean {
  if (coin.minUsd === null) return false;
  return coin.minUsd <= priceUsd * MIN_MARGIN;
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export interface InvoiceRequest {
  priceAmount: number;
  priceCurrency: "usd";
  payCurrency: string;
  orderId: string;
  orderDescription: string;
  ipnCallbackUrl: string;
  successUrl: string;
  cancelUrl: string;
}

export interface InvoiceResponse {
  id: string | number;
  order_id: string;
  invoice_url: string;
  price_amount: string | number;
  price_currency: string;
  pay_currency: string | null;
}

export async function createInvoice(req: InvoiceRequest): Promise<{ id: string; url: string }> {
  const res = await call<InvoiceResponse>("POST", "/invoice", {
    price_amount: req.priceAmount,
    price_currency: req.priceCurrency,
    pay_currency: req.payCurrency,
    order_id: req.orderId,
    order_description: req.orderDescription,
    ipn_callback_url: req.ipnCallbackUrl,
    success_url: req.successUrl,
    cancel_url: req.cancelUrl,
    is_fee_paid_by_user: false,
  });
  if (!res || res.order_id !== req.orderId || typeof res.invoice_url !== "string") {
    throw new Error("NOWPayments returned an unexpected invoice response");
  }
  const url = new URL(res.invoice_url);
  if (url.protocol !== "https:" || !/(^|\.)nowpayments\.io$/.test(url.hostname)) {
    // Only ever send a buyer to the provider's own hosted page.
    throw new Error("NOWPayments invoice URL is not on nowpayments.io");
  }
  return { id: String(res.id), url: res.invoice_url };
}

// ---------------------------------------------------------------------------
// IPN signature
// ---------------------------------------------------------------------------

/** Recursively sorts object keys, as NOWPayments does before signing. */
export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

export function signPayload(payload: unknown, secret: string): string {
  return createHmac("sha512", secret).update(JSON.stringify(sortKeysDeep(payload))).digest("hex");
}

/**
 * Verifies `x-nowpayments-sig`: HMAC-SHA512 with the IPN secret over the JSON
 * body with keys sorted. Constant-time compare; a missing secret fails closed.
 */
export function verifyIpnSignature(payload: unknown, signature: string | null): boolean {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret || !signature) return false;
  if (!/^[0-9a-f]{128}$/i.test(signature)) return false;
  const expected = Buffer.from(signPayload(payload, secret), "hex");
  const given = Buffer.from(signature.toLowerCase(), "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
