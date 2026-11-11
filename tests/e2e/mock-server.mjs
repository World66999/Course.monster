// Stand-in for every outside service the site talks to: the three link
// shorteners, the Telegram Bot API, Razorpay and NOWPayments. Test use only.
//
//   node tests/e2e/mock-server.mjs            (port from E2E_MOCK_PORT, default 47000)
//
// It records what the site sent (GET /__log, DELETE /__log) so tests can
// assert on it, and tests can make a shortener fail (POST /__fail/<provider>,
// DELETE /__fail/<provider>) or register a Razorpay payment (POST /rzp/__payment).
import http from "node:http";

const PORT = Number(process.env.E2E_MOCK_PORT ?? 47000);
const log = [];
const failing = new Set();
const rzpPayments = new Map();
let seq = 1000;

// A small NOWPayments catalogue: the popular coins plus two that are too
// expensive for the $1 plan, so "hide coins whose minimum does not fit" is exercised.
const COINS = [
  ["usdtbsc", "USDT", "Tether USD (BSC)", "bsc", 0.09],
  ["usdcbsc", "USDC", "USD Coin (BSC)", "bsc", 0.095],
  ["ltc", "LTC", "Litecoin", "ltc", 0.04],
  ["trx", "TRX", "Tron", "trx", 0.24],
  ["usdtmatic", "USDT", "Tether USD (Polygon)", "matic", 0.16],
  ["sol", "SOL", "Solana", "sol", 0.54],
  ["eth", "ETH", "Ethereum", "eth", 0.42],
  ["doge", "DOGE", "Dogecoin", "doge", 0.94],
  ["btc", "BTC", "Bitcoin", "btc", 21.2],
  ["usdttrc20", "USDT", "Tether USD (TRC20)", "trx", 11.2],
];

const send = (res, code, body) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
};

http
  .createServer(async (req, res) => {
    const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
    let raw = "";
    for await (const chunk of req) raw += chunk;
    let json = {};
    try {
      json = raw ? JSON.parse(raw) : {};
    } catch {
      json = {};
    }

    // ---- test controls ----
    if (u.pathname === "/__log") {
      if (req.method === "DELETE") log.length = 0;
      return send(res, 200, log);
    }
    const fail = u.pathname.match(/^\/__fail\/(vplink|gplinks|linkshortify)$/);
    if (fail) {
      if (req.method === "DELETE") failing.delete(fail[1]);
      else failing.add(fail[1]);
      return send(res, 200, { failing: [...failing] });
    }
    if (u.pathname === "/__health") return send(res, 200, { ok: true });

    // ---- link shorteners ----
    const shortener = u.pathname.match(/^\/(vplink|gplinks|linkshortify)\/api$/);
    if (shortener) {
      const provider = shortener[1];
      log.push({ shortener: provider, url: u.searchParams.get("url"), hasToken: Boolean(u.searchParams.get("api")) });
      if (failing.has(provider)) return send(res, 200, { status: "error", message: "mock failure" });
      return send(res, 200, {
        status: "success",
        message: "",
        shortenedUrl: `https://${provider}.mock/s?u=${encodeURIComponent(u.searchParams.get("url") ?? "")}`,
      });
    }

    // ---- Razorpay ----
    if (u.pathname.startsWith("/rzp/")) {
      const path = u.pathname.slice(4);
      if (req.method === "POST" && path === "/__payment") {
        rzpPayments.set(json.id, json);
        return send(res, 200, {});
      }
      log.push({ razorpay: `${req.method} ${path}`, auth: Boolean(req.headers.authorization?.startsWith("Basic ")), body: json });
      if (!req.headers.authorization?.startsWith("Basic ")) return send(res, 401, { error: { description: "auth" } });
      if (req.method === "POST" && path === "/v1/orders") {
        return send(res, 200, {
          id: `order_MOCK${String(++seq).padStart(8, "0")}`,
          amount: json.amount,
          currency: json.currency,
          receipt: json.receipt,
          status: "created",
          notes: json.notes,
        });
      }
      if (req.method === "POST" && path === "/v1/payment_links") {
        const n = ++seq;
        return send(res, 200, {
          id: `plink_MOCK${String(n).padStart(8, "0")}`,
          short_url: `https://rzp.mock/i/${n}`,
          amount: json.amount,
          currency: json.currency,
          reference_id: json.reference_id,
          status: "created",
        });
      }
      const pay = path.match(/^\/v1\/payments\/(pay_[A-Za-z0-9]+)$/);
      if (req.method === "GET" && pay) {
        const p = rzpPayments.get(pay[1]);
        return p ? send(res, 200, p) : send(res, 400, { error: { description: "The id provided does not exist" } });
      }
      return send(res, 404, { error: { description: "not mocked" } });
    }

    // ---- NOWPayments ----
    if (u.pathname.startsWith("/np/v1/")) {
      const path = u.pathname.slice("/np/v1".length);
      log.push({ nowpayments: `${req.method} ${path}${u.search}`, key: Boolean(req.headers["x-api-key"]), body: json });
      if (path === "/merchant/coins") return send(res, 200, { selectedCurrencies: COINS.map((c) => c[0].toUpperCase()) });
      if (path === "/full-currencies") {
        return send(res, 200, {
          currencies: COINS.map(([code, ticker, name, network], i) => ({
            code: code.toUpperCase(),
            ticker: ticker.toLowerCase(),
            name,
            network,
            logo_url: `/images/coins/${code}.svg`,
            enable: true,
            available_for_payment: true,
            priority: i,
          })),
        });
      }
      if (path === "/min-amount") {
        const from = (u.searchParams.get("currency_from") ?? "").toLowerCase();
        const coin = COINS.find((c) => c[0] === from);
        return send(res, 200, { currency_from: from, currency_to: from, min_amount: 1, fiat_equivalent: coin ? coin[4] : 5 });
      }
      if (req.method === "POST" && path === "/invoice") {
        const id = ++seq;
        return send(res, 200, {
          id,
          order_id: json.order_id,
          // The site only accepts an invoice page on nowpayments.io; the tests never load it.
          invoice_url: `https://nowpayments.io/payment/?iid=${id}`,
          price_amount: String(json.price_amount),
          price_currency: json.price_currency,
          pay_currency: json.pay_currency,
        });
      }
      return send(res, 404, { message: "not mocked" });
    }

    // ---- Telegram Bot API ----
    const tg = u.pathname.match(/^\/bot[^/]+\/(\w+)$/);
    if (tg) {
      const method = tg[1];
      log.push({ telegram: method, body: json });
      if (method === "getMe") return send(res, 200, { ok: true, result: { id: 111111, is_bot: true, username: "e2e_test_bot" } });
      if (method === "getChatMember") return send(res, 200, { ok: true, result: { status: "member" } });
      if (method === "createChatInviteLink") return send(res, 200, { ok: true, result: { invite_link: `https://t.me/+e2e${++seq}` } });
      return send(res, 200, { ok: true, result: { message_id: ++seq, chat: { id: 1 }, date: 0 } });
    }

    send(res, 404, { error: "not mocked" });
  })
  .listen(PORT, "127.0.0.1", () => console.log(`mock services on :${PORT}`));
