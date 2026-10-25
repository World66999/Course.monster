import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanCoinName,
  coinFitsPrice,
  isTicker,
  MIN_MARGIN,
  networkLabel,
  normalizeQuery,
  POPULAR_COINS,
  searchCoins,
  type CatalogCoin,
} from "../src/lib/coins.ts";

/**
 * The checkout only lists coins that work for the plan, and the server refuses
 * anything else, so these rules decide what customers can pay with.
 */

const coin = (ticker: string, symbol: string, name: string, networkCode: string, priority = 100): CatalogCoin => ({
  ticker,
  symbol,
  name,
  networkCode,
  network: networkLabel(networkCode),
  logoUrl: null,
  priority,
});

const CATALOG: CatalogCoin[] = [
  coin("btc", "BTC", "Bitcoin", "btc", 0),
  coin("doge", "DOGE", "Dogecoin", "doge", 10),
  coin("babydoge", "BABYDOGE", "Baby Doge Coin", "bsc", 300),
  coin("bnbbsc", "BNB", "Binance Coin", "bsc", 96),
  coin("cakebsc", "CAKE", "PancakeSwap", "bsc", 150),
  coin("usdterc20", "USDT", "Tether USD", "eth", 20),
  coin("usdttrc20", "USDT", "Tether USD", "trx", 10),
  coin("xrp", "XRP", "Ripple", "xrp", 21),
];

test("a coin fits a price only when its minimum is known and under the price with margin", () => {
  assert.equal(coinFitsPrice(0.09, 1), true, "USDT-BSC on the $1 plan");
  assert.equal(coinFitsPrice(21.24, 1), false, "BTC on the $1 plan");
  assert.equal(coinFitsPrice(21.24, 10), false, "BTC on the $10 plan");
  assert.equal(coinFitsPrice(11.23, 10), false, "USDT-TRC20 on the $10 plan");
  assert.equal(coinFitsPrice(0.94, 1), false, "DOGE is too close to $1");
  assert.equal(coinFitsPrice(0.94, 10), true, "…but fine for $10, so lists differ by plan");
  assert.equal(coinFitsPrice(MIN_MARGIN, 1), true, "exactly at the margin");
  assert.equal(coinFitsPrice(null, 10), false, "an unchecked coin is never offered");
  assert.equal(coinFitsPrice(Number.NaN, 10), false);
  assert.equal(coinFitsPrice(0, 10), false, "a zero/garbage minimum is treated as unknown");
});

test("the popular list is the agreed order and excludes BTC", () => {
  assert.deepEqual([...POPULAR_COINS], ["usdtbsc", "usdcbsc", "ltc", "trx", "usdtmatic", "sol", "eth"]);
});

test("search: exact code first, then other matches", () => {
  const r = searchCoins(CATALOG, "doge").map((c) => c.ticker);
  assert.equal(r[0], "doge");
  assert.ok(r.includes("babydoge"));
  assert.ok(!r.includes("btc"));
});

test("search: 'bnb' finds BNB itself first, then the BNB Smart Chain tokens", () => {
  const r = searchCoins(CATALOG, "bnb").map((c) => c.ticker);
  assert.equal(r[0], "bnbbsc");
  assert.ok(r.includes("cakebsc") && r.includes("babydoge"), "BEP20 tokens match via the network alias");
  assert.ok(!r.includes("usdterc20"));
});

test("search: every word must match, so 'usdt tron' picks the TRC20 one", () => {
  assert.deepEqual(searchCoins(CATALOG, "usdt tron").map((c) => c.ticker), ["usdttrc20"]);
  assert.deepEqual(searchCoins(CATALOG, "usdt erc20").map((c) => c.ticker), ["usdterc20"]);
});

test("search: case, punctuation and empty input", () => {
  assert.equal(searchCoins(CATALOG, "  DoGe!! ")[0]?.ticker, "doge");
  assert.deepEqual(searchCoins(CATALOG, ""), []);
  assert.deepEqual(searchCoins(CATALOG, "   "), []);
  assert.deepEqual(searchCoins(CATALOG, "zzzz"), []);
  assert.equal(searchCoins(CATALOG, "e", 2).length, 2, "limit is respected");
  assert.equal(normalizeQuery("x".repeat(100)).length, 40);
});

test("names lose the provider's network suffix; networks get readable labels", () => {
  assert.equal(cleanCoinName("Tether USD (BSC)"), "Tether USD");
  assert.equal(cleanCoinName("Bitcoin"), "Bitcoin");
  assert.equal(networkLabel("bsc"), "BNB Smart Chain (BEP20)");
  assert.equal(networkLabel("matic"), "Polygon");
  assert.equal(networkLabel("kas"), "Kaspa");
  assert.equal(networkLabel("somechain"), "SOMECHAIN");
  assert.equal(networkLabel("null"), "");
});

test("tickers from the browser are validated strictly", () => {
  assert.equal(isTicker("usdtbsc"), true);
  for (const bad of ["", "a", "USDT", "usdt-bsc", "../x", "a".repeat(21), 5, null]) assert.equal(isTicker(bad), false);
});
