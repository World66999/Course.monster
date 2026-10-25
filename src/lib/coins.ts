/**
 * Checkout coin catalogue: shared, client-safe logic.
 *
 * The coin list itself comes from NOWPayments on the server (see
 * nowpayments.ts); this module only holds what both sides need to agree on —
 * the popular-coin order, network display names, the search ranking, and the
 * one rule for whether a coin's minimum fits a plan price.
 */

export interface CatalogCoin {
  /** NOWPayments currency code, lowercase (e.g. "usdtbsc"). */
  ticker: string;
  /** Display symbol, uppercase (e.g. "USDT"). */
  symbol: string;
  /** Coin name without the network suffix (e.g. "Tether USD"). */
  name: string;
  /** NOWPayments network code, lowercase (e.g. "bsc"). */
  networkCode: string;
  /** Network display name (e.g. "BNB Smart Chain (BEP20)"). */
  network: string;
  /** Absolute https URL on nowpayments.io, or null. */
  logoUrl: string | null;
  /** NOWPayments display priority; lower is more prominent. */
  priority: number;
}

/** A coin as the checkout shows it. Only coins that work for the plan are ever sent. */
export type CheckoutCoin = Omit<CatalogCoin, "priority" | "networkCode">;

/** Shown first, in this order, when the account supports them and they fit the plan. */
export const POPULAR_COINS = ["usdtbsc", "usdcbsc", "ltc", "trx", "usdtmatic", "sol", "eth"] as const;

/**
 * Safety margin over the provider's minimum. Network fees and rate movement
 * between invoice and payment can push a borderline amount under the line,
 * which turns into a partially_paid payment the user has to chase.
 */
export const MIN_MARGIN = 0.85;

/**
 * The one rule for whether a coin can be offered at a price: its live minimum
 * is known and sits under the price with margin to spare. Coins that fail are
 * not offered at all for that plan.
 */
export function coinFitsPrice(minUsd: number | null, priceUsd: number): boolean {
  return minUsd !== null && Number.isFinite(minUsd) && minUsd > 0 && minUsd <= priceUsd * MIN_MARGIN;
}

/** Shortest search the server will run, so one keystroke can't fan out over the whole catalogue. */
export const MIN_SEARCH_LENGTH = 2;

const NETWORKS: Record<string, { label: string; aliases?: string }> = {
  bsc: { label: "BNB Smart Chain (BEP20)", aliases: "bnb bep20 binance bsc" },
  eth: { label: "Ethereum (ERC20)", aliases: "erc20 ethereum" },
  trx: { label: "TRON (TRC20)", aliases: "tron trc20" },
  matic: { label: "Polygon", aliases: "polygon pol matic" },
  sol: { label: "Solana", aliases: "solana spl" },
  ton: { label: "TON", aliases: "toncoin ton" },
  arbitrum: { label: "Arbitrum One", aliases: "arb arbitrum" },
  base: { label: "Base" },
  avaxc: { label: "Avalanche C-Chain", aliases: "avax avalanche" },
  op: { label: "Optimism", aliases: "optimism op" },
  opbnb: { label: "opBNB", aliases: "bnb opbnb" },
  zksync: { label: "zkSync Era", aliases: "zksync" },
  btc: { label: "Bitcoin" },
  ltc: { label: "Litecoin" },
  doge: { label: "Dogecoin" },
  xrp: { label: "XRP Ledger", aliases: "ripple" },
  ada: { label: "Cardano" },
  algo: { label: "Algorand" },
  apt: { label: "Aptos" },
  atom: { label: "Cosmos" },
  bch: { label: "Bitcoin Cash" },
  celo: { label: "Celo" },
  cro: { label: "Cronos" },
  dash: { label: "Dash" },
  dgb: { label: "DigiByte" },
  egld: { label: "MultiversX" },
  etc: { label: "Ethereum Classic" },
  fil: { label: "Filecoin" },
  hbar: { label: "Hedera" },
  inj: { label: "Injective" },
  kas: { label: "Kaspa" },
  near: { label: "NEAR" },
  strk: { label: "Starknet" },
  sui: { label: "Sui" },
  vet: { label: "VeChain" },
  xlm: { label: "Stellar" },
  xmr: { label: "Monero" },
  xtz: { label: "Tezos" },
  zec: { label: "Zcash" },
};

export function networkLabel(code: string): string {
  const c = code.toLowerCase();
  return NETWORKS[c]?.label ?? (c && c !== "null" ? c.toUpperCase() : "");
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Normalises a search box value; empty string means "no search". */
export function normalizeQuery(q: string): string {
  return norm(q).slice(0, 40);
}

function tokenScore(coin: CatalogCoin, token: string): number {
  const code = coin.ticker;
  const symbol = coin.symbol.toLowerCase();
  const name = norm(coin.name);
  if (code === token) return 100;
  if (symbol === token) return 90;
  if (code.startsWith(token)) return 70;
  if (symbol.startsWith(token)) return 65;
  if (name.split(" ").some((w) => w.startsWith(token))) return 50;
  if (name.includes(token)) return 30;
  const net = `${coin.networkCode} ${norm(coin.network)} ${NETWORKS[coin.networkCode]?.aliases ?? ""}`;
  if (net.split(" ").some((w) => w && w.startsWith(token))) return 20;
  return 0;
}

/**
 * Ranks coins for a search query. Every word in the query must match the coin
 * (code, symbol, name, or network and its aliases, so "bnb" finds BNB itself
 * and the BEP20 tokens); exact code/symbol matches rank first, then
 * NOWPayments' own priority.
 */
export function searchCoins(coins: readonly CatalogCoin[], query: string, limit = 20): CatalogCoin[] {
  const q = normalizeQuery(query);
  if (!q) return [];
  const tokens = q.split(" ");
  const scored: { coin: CatalogCoin; score: number }[] = [];
  for (const coin of coins) {
    let score = 0;
    for (const t of tokens) {
      const s = tokenScore(coin, t);
      if (s === 0) {
        score = 0;
        break;
      }
      score += s;
    }
    if (score > 0) scored.push({ coin, score });
  }
  scored.sort((a, b) => b.score - a.score || a.coin.priority - b.coin.priority || a.coin.ticker.localeCompare(b.coin.ticker));
  return scored.slice(0, limit).map((s) => s.coin);
}

/** Strips the trailing "(BSC)"-style network suffix NOWPayments puts in names. */
export function cleanCoinName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim() || name;
}

const TICKER_RE = /^[a-z0-9]{2,20}$/;

export function isTicker(value: unknown): value is string {
  return typeof value === "string" && TICKER_RE.test(value);
}

export function toCheckoutCoin(c: CatalogCoin): CheckoutCoin {
  return { ticker: c.ticker, symbol: c.symbol, name: c.name, network: c.network, logoUrl: c.logoUrl };
}
