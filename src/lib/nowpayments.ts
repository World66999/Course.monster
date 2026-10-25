import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cleanCoinName, coinFitsPrice, isTicker, networkLabel, POPULAR_COINS, type CatalogCoin } from "@/lib/coins";

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
 * The coin catalogue is the set of currencies enabled on this merchant account
 * (/merchant/coins) joined with their public metadata (/full-currencies), minus
 * anything NOWPayments has switched off for payments. It changes rarely, so it
 * is cached for hours and refreshed in the background once stale; an outage
 * keeps serving the last good copy.
 *
 * Whether a coin can be offered for a given plan is a separate, live question
 * answered by /min-amount (see coinMinimum): a $1 invoice is below the minimum
 * for coins like BTC (~$21) or USDT on TRON (~$11). The checkout only ever
 * offers coins that are in the catalogue AND whose minimum fits the price.
 */

interface MerchantCoinsResponse {
  selectedCurrencies?: string[];
}

interface FullCurrency {
  code?: string;
  name?: string;
  ticker?: string;
  network?: string | null;
  logo_url?: string | null;
  enable?: boolean;
  available_for_payment?: boolean;
  priority?: number;
}

interface MinAmountResponse {
  currency_from: string;
  currency_to: string;
  min_amount: number;
  fiat_equivalent?: number;
}

const CATALOG_TTL_MS = 6 * 60 * 60 * 1000;
const CATALOG_RETRY_MS = 2 * 60 * 1000;
const MIN_TTL_MS = 30 * 60 * 1000;
const MIN_FAIL_TTL_MS = 2 * 60 * 1000;
const LOGO_PATH = /^\/images\/coins\/[a-z0-9_.-]+\.(svg|png)$/i;

/**
 * Used only if NOWPayments can't be reached and there is no cached catalogue
 * yet (e.g. right after a restart during an outage). All of these are enabled
 * on the account (checked 2026-10-25); availability is still decided by the
 * live minimum, which fails closed if the API is down.
 */
const FALLBACK: Record<(typeof POPULAR_COINS)[number], { symbol: string; name: string; network: string }> = {
  usdtbsc: { symbol: "USDT", name: "Tether USD", network: "bsc" },
  usdcbsc: { symbol: "USDC", name: "USD Coin", network: "bsc" },
  ltc: { symbol: "LTC", name: "Litecoin", network: "ltc" },
  trx: { symbol: "TRX", name: "Tron", network: "trx" },
  usdtmatic: { symbol: "USDT", name: "Tether USD", network: "matic" },
  sol: { symbol: "SOL", name: "Solana", network: "sol" },
  eth: { symbol: "ETH", name: "Ethereum", network: "eth" },
};

function logoUrl(path: string | null | undefined, ticker: string): string | null {
  const p = path || `/images/coins/${ticker}.svg`;
  return LOGO_PATH.test(p) ? `https://nowpayments.io${p}` : null;
}

function toCatalogCoin(ticker: string, symbol: string, name: string, network: string, logo: string | null | undefined, priority: number): CatalogCoin {
  const networkCode = network && network !== "null" ? network.toLowerCase() : "";
  return {
    ticker,
    symbol: (symbol || ticker).toUpperCase().slice(0, 16),
    name: cleanCoinName(name || ticker.toUpperCase()).slice(0, 60),
    networkCode,
    network: networkLabel(networkCode) || cleanCoinName(name || ticker.toUpperCase()),
    logoUrl: logoUrl(logo, ticker),
    priority: Number.isFinite(priority) ? priority : 1000,
  };
}

function fallbackCatalog(): CatalogCoin[] {
  return POPULAR_COINS.map((t, i) => {
    const f = FALLBACK[t];
    return toCatalogCoin(t, f.symbol, f.name, f.network, null, i);
  });
}

interface CoinCaches {
  catalog: { at: number; ttl: number; coins: CatalogCoin[]; byTicker: Map<string, CatalogCoin> } | null;
  catalogInflight: Promise<void> | null;
  min: Map<string, { at: number; minUsd: number | null }>;
  minInflight: Map<string, Promise<number | null>>;
}

// One store per process. Next.js bundles route handlers and pages/actions into
// separate module graphs, so plain module-level variables would give the coin
// search route and the checkout action two caches and double the API calls.
const caches: CoinCaches = ((globalThis as unknown as { __nowpaymentsCoinCaches?: CoinCaches }).__nowpaymentsCoinCaches ??= {
  catalog: null,
  catalogInflight: null,
  min: new Map(),
  minInflight: new Map(),
});

async function loadCatalog(): Promise<void> {
  try {
    const [merchant, full] = await Promise.all([
      call<MerchantCoinsResponse>("GET", "/merchant/coins"),
      call<{ currencies?: FullCurrency[] }>("GET", "/full-currencies"),
    ]);
    const enabled = new Set((merchant.selectedCurrencies ?? []).map((c) => String(c).toLowerCase()));
    const coins: CatalogCoin[] = [];
    for (const c of full.currencies ?? []) {
      const ticker = String(c.code ?? "").toLowerCase();
      if (!isTicker(ticker) || !enabled.has(ticker)) continue;
      if (c.enable === false || c.available_for_payment === false) continue;
      coins.push(toCatalogCoin(ticker, c.ticker ?? "", c.name ?? "", c.network ?? "", c.logo_url, c.priority ?? 1000));
    }
    if (coins.length === 0) throw new Error("empty coin catalogue");
    caches.catalog = { at: Date.now(), ttl: CATALOG_TTL_MS, coins, byTicker: new Map(coins.map((c) => [c.ticker, c])) };
  } catch (err) {
    console.warn("[nowpayments] coin catalogue refresh failed:", err instanceof Error ? err.message : err);
    if (!caches.catalog) {
      const coins = fallbackCatalog();
      caches.catalog = { at: Date.now(), ttl: CATALOG_RETRY_MS, coins, byTicker: new Map(coins.map((c) => [c.ticker, c])) };
    } else {
      // Keep serving the last good copy; try again soon.
      caches.catalog = { ...caches.catalog, at: Date.now(), ttl: CATALOG_RETRY_MS };
    }
  }
}

/** Every coin this account can be paid in. Cached; stale copies are served while refreshing. */
export async function coinCatalog(): Promise<CatalogCoin[]> {
  const fresh = caches.catalog && Date.now() - caches.catalog.at < caches.catalog.ttl;
  if (!fresh) {
    caches.catalogInflight ??= loadCatalog().finally(() => {
      caches.catalogInflight = null;
    });
    if (!caches.catalog) await caches.catalogInflight;
  }
  return caches.catalog?.coins ?? [];
}

export async function findCatalogCoin(ticker: string): Promise<CatalogCoin | null> {
  if (!isTicker(ticker)) return null;
  await coinCatalog();
  return caches.catalog?.byTicker.get(ticker) ?? null;
}


/**
 * Smallest invoice in USD the coin accepts, live from NOWPayments, cached for
 * 30 minutes (2 minutes after a failure). Null means it couldn't be checked,
 * and an unchecked coin is never offered.
 */
export async function coinMinimum(ticker: string): Promise<number | null> {
  if (!isTicker(ticker)) return null;
  const hit = caches.min.get(ticker);
  if (hit && Date.now() - hit.at < (hit.minUsd === null ? MIN_FAIL_TTL_MS : MIN_TTL_MS)) return hit.minUsd;
  const pending = caches.minInflight.get(ticker);
  if (pending) return pending;

  const p = (async () => {
    let minUsd: number | null = null;
    try {
      const res = await call<MinAmountResponse>(
        "GET",
        `/min-amount?currency_from=${ticker}&currency_to=${ticker}&fiat_equivalent=usd&is_fee_paid_by_user=false`
      );
      minUsd = typeof res.fiat_equivalent === "number" && Number.isFinite(res.fiat_equivalent) ? res.fiat_equivalent : null;
    } catch (err) {
      console.warn(`[nowpayments] min-amount check failed for ${ticker}:`, err instanceof Error ? err.message : err);
    }
    caches.min.set(ticker, { at: Date.now(), minUsd });
    if (caches.min.size > 2000) caches.min.delete(caches.min.keys().next().value as string);
    return minUsd;
  })().finally(() => caches.minInflight.delete(ticker));
  caches.minInflight.set(ticker, p);
  return p;
}

/** Keeps only the coins whose live minimum fits `priceUsd`, preserving order. */
export async function coinsForPrice<T extends { ticker: string }>(coins: readonly T[], priceUsd: number, concurrency = 8): Promise<T[]> {
  const fits = new Array<boolean>(coins.length).fill(false);
  let next = 0;
  async function worker() {
    while (next < coins.length) {
      const i = next++;
      fits[i] = coinFitsPrice(await coinMinimum(coins[i]!.ticker), priceUsd);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, coins.length) }, worker));
  return coins.filter((_, i) => fits[i]);
}

/** Popular coins in display order, as far as the catalogue has them. */
export async function popularCatalogCoins(): Promise<CatalogCoin[]> {
  await coinCatalog();
  return POPULAR_COINS.map((t) => caches.catalog?.byTicker.get(t)).filter((c): c is CatalogCoin => Boolean(c));
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
