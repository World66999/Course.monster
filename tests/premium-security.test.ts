import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { signPayload, sortKeysDeep, verifyIpnSignature } from "../src/lib/nowpayments.ts";
import { verifyInitData } from "../src/lib/telegram/webapp-auth.ts";
import { consumePremiumLinkToken, createPremiumLinkToken } from "../src/lib/premium-link-token.ts";
import { cleanText } from "../src/lib/sanitize.ts";

/**
 * The checks every Premium unlock ultimately rests on: the NOWPayments IPN
 * signature, Telegram Mini App initData, and the single-use resource link.
 * All secrets here are throwaway test values.
 */

process.env.NOWPAYMENTS_IPN_SECRET = "test-ipn-secret";
process.env.DOWNLOAD_TOKEN_SECRET = "test-download-secret";

// --- IPN ------------------------------------------------------------------

test("sortKeysDeep sorts nested object keys and keeps array order", () => {
  const sorted = sortKeysDeep({ b: 1, a: { d: [{ z: 1, y: 2 }], c: null } });
  assert.equal(JSON.stringify(sorted), '{"a":{"c":null,"d":[{"y":2,"z":1}]},"b":1}');
});

test("the IPN signature is HMAC-SHA512 over the key-sorted JSON", () => {
  const payload = { payment_status: "finished", order_id: "cvp_x", price_amount: 1 };
  const manual = createHmac("sha512", "test-ipn-secret")
    .update('{"order_id":"cvp_x","payment_status":"finished","price_amount":1}')
    .digest("hex");
  assert.equal(signPayload(payload, "test-ipn-secret"), manual);
  assert.equal(verifyIpnSignature(payload, manual), true);
  // Key order in the body does not matter.
  assert.equal(verifyIpnSignature({ price_amount: 1, order_id: "cvp_x", payment_status: "finished" }, manual), true);
});

test("a forged, tampered, missing or malformed IPN signature is rejected", () => {
  const payload = { payment_status: "finished", order_id: "cvp_x", price_amount: 1 };
  const good = signPayload(payload, "test-ipn-secret");
  assert.equal(verifyIpnSignature(payload, signPayload(payload, "wrong-secret")), false);
  assert.equal(verifyIpnSignature({ ...payload, price_amount: 10 }, good), false);
  assert.equal(verifyIpnSignature(payload, null), false);
  assert.equal(verifyIpnSignature(payload, "abc"), false);
  assert.equal(verifyIpnSignature(payload, good.slice(0, 64)), false);
});

test("the IPN check fails closed when the secret is not configured", () => {
  const payload = { a: 1 };
  const sig = signPayload(payload, "test-ipn-secret");
  const saved = process.env.NOWPAYMENTS_IPN_SECRET;
  delete process.env.NOWPAYMENTS_IPN_SECRET;
  try {
    assert.equal(verifyIpnSignature(payload, sig), false);
  } finally {
    process.env.NOWPAYMENTS_IPN_SECRET = saved;
  }
});

// --- Mini App initData ----------------------------------------------------

const BOT = "123456:TEST-token";

function initData(fields: Record<string, string>, token = BOT): string {
  const check = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(check).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

const NOW = 1_800_000_000;
const user = JSON.stringify({ id: 42, username: "ada", first_name: "Ada" });

test("valid, fresh initData yields the Telegram user", () => {
  const data = initData({ auth_date: String(NOW - 10), query_id: "q", user });
  assert.deepEqual(verifyInitData(data, BOT, NOW), { telegramId: "42", username: "ada", firstName: "Ada" });
});

test("initData signed with another bot token, tampered, or stale is rejected", () => {
  assert.equal(verifyInitData(initData({ auth_date: String(NOW), user }, "999:other"), BOT, NOW), null);

  const tampered = initData({ auth_date: String(NOW), user }).replace("%3A42", "%3A43");
  assert.equal(verifyInitData(tampered, BOT, NOW), null);

  assert.equal(verifyInitData(initData({ auth_date: String(NOW - 2 * 3600), user }), BOT, NOW), null);
  assert.equal(verifyInitData(initData({ auth_date: String(NOW + 3600), user }), BOT, NOW), null);
  assert.equal(verifyInitData(new URLSearchParams({ auth_date: String(NOW), user }).toString(), BOT, NOW), null);
  assert.equal(verifyInitData(initData({ auth_date: String(NOW), user }), "", NOW), null);
});

// --- Premium resource link ------------------------------------------------

test("a premium link token works once, only for its user and resource", () => {
  const t = createPremiumLinkToken("user-a", "res-1");
  assert.equal(consumePremiumLinkToken(t, "user-b", "res-1"), false);
  assert.equal(consumePremiumLinkToken(t, "user-a", "res-2"), false);
  assert.equal(consumePremiumLinkToken(t, "user-a", "res-1"), true);
  assert.equal(consumePremiumLinkToken(t, "user-a", "res-1"), false, "replay must fail");
});

test("a premium link token with a forged signature is rejected", () => {
  const t = createPremiumLinkToken("user-a", "res-1");
  const [data] = t.split(".");
  assert.equal(consumePremiumLinkToken(`${data}.AAAA`, "user-a", "res-1"), false);
  assert.equal(consumePremiumLinkToken("garbage", "user-a", "res-1"), false);
});

// --- Sanitization ---------------------------------------------------------

test("cleanText strips control characters, trims and caps length", () => {
  assert.equal(cleanText("  hi\u0000\u0007 there  ", 100), "hi there");
  assert.equal(cleanText(123, 10), "");
  assert.equal(cleanText("x".repeat(50), 10).length, 10);
});
