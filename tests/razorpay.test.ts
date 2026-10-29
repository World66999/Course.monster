import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyCheckoutSignature, verifyWebhookSignature, maskId, type RzpPayment } from "../src/lib/razorpay.ts";
import {
  CREATE_LIMIT_IP,
  CREATE_LIMIT_USER,
  allowPaymentCreation,
  confirmCheckout,
  isReusable,
  settle,
  judgePayment,
  processWebhook,
  type CheckoutDeps,
  type FulfilResult,
  type RzpRow,
  type WebhookDeps,
} from "../src/lib/razorpay-core.ts";
import { formatInr, inrPaise, PLANS } from "../src/lib/premium-plans.ts";
import { paymentEnvProblems } from "../src/lib/razorpay-config.ts";

/**
 * Razorpay payment security: signatures, amount checks, idempotency, replay,
 * expiry and rate limits. Runs the real settlement rules against an
 * in-memory store that enforces the same constraints as the database (unique
 * payment id, conditional fulfilment). All secrets are throwaway test values.
 */

const KEY_SECRET = "test_key_secret_123";
const WEBHOOK_SECRET = "test_webhook_secret_456";
process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;

const sign = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest("hex");

// ---------------------------------------------------------------------------
// In-memory world
// ---------------------------------------------------------------------------

interface World {
  rows: Map<string, RzpRow>;
  payments: Map<string, RzpPayment>;
  premiumGrants: { userId: string; rowId: string }[];
  flagged: { rowId: string; reason: string }[];
  notices: string[];
  events: Set<string>;
  apiCalls: number;
}

function newWorld(): World {
  return { rows: new Map(), payments: new Map(), premiumGrants: [], flagged: [], notices: [], events: new Set(), apiCalls: 0 };
}

let seq = 0;
function addRow(w: World, over: Partial<RzpRow> = {}): RzpRow {
  seq++;
  const row: RzpRow = {
    id: `row${seq}`,
    userId: `user${seq}`,
    telegramId: null,
    plan: "YEARLY",
    channel: "WEB",
    amount: inrPaise(PLANS.YEARLY.priceUsd, 100),
    currency: "INR",
    referenceId: `cvw_ref${seq}`,
    orderId: `order_TEST${String(seq).padStart(6, "0")}`,
    paymentLinkId: null,
    paymentId: null,
    status: "PENDING",
    expiresAt: new Date(Date.now() + 30 * 60_000),
    fulfilledAt: null,
    ...over,
  };
  w.rows.set(row.id, row);
  return row;
}

function addPayment(w: World, p: Partial<RzpPayment> & { id: string }): RzpPayment {
  const full: RzpPayment = { order_id: null, amount: 0, currency: "INR", status: "captured", ...p };
  w.payments.set(full.id, full);
  return full;
}

function deps(w: World): WebhookDeps & CheckoutDeps {
  const find = (pred: (r: RzpRow) => boolean) => {
    for (const r of w.rows.values()) if (pred(r)) return { ...r };
    return null;
  };
  return {
    fetchPayment: async (id) => {
      w.apiCalls++;
      const p = w.payments.get(id);
      if (!p) throw new Error("payment not found");
      return { ...p };
    },
    fulfil: async (row, paymentId): Promise<FulfilResult> => {
      for (const r of w.rows.values()) if (r.paymentId === paymentId && r.id !== row.id) return { result: "replayed" };
      const live = w.rows.get(row.id)!;
      if (live.fulfilledAt || live.status === "FLAGGED") return { result: "duplicate" };
      live.fulfilledAt = new Date();
      live.status = "PAID";
      live.paymentId = paymentId;
      w.premiumGrants.push({ userId: live.userId, rowId: live.id });
      return { result: "applied", expiresAt: new Date(Date.now() + 365 * 86_400_000) };
    },
    flag: async (row, reason) => {
      const live = w.rows.get(row.id)!;
      if (live.fulfilledAt) return;
      live.status = "FLAGGED";
      w.flagged.push({ rowId: row.id, reason });
    },
    onApplied: async (row) => void w.notices.push(`applied:${row.id}`),
    log: () => {},
    // Replaced by webhookDeps / checkoutDeps below.
    verifySignature: () => false,
    findOwnRow: async (orderId) => find((r) => r.orderId === orderId),
    findByOrderId: async (orderId) => find((r) => r.orderId === orderId),
    findByLinkId: async (linkId) => find((r) => r.paymentLinkId === linkId),
    attachOrderId: async (row, orderId) => {
      if ([...w.rows.values()].some((r) => r.orderId === orderId)) return false;
      const live = w.rows.get(row.id)!;
      if (live.orderId) return false;
      live.orderId = orderId;
      return true;
    },
    close: async (row, status) => {
      const live = w.rows.get(row.id)!;
      if (live.status !== "PENDING" || live.fulfilledAt) return false;
      live.status = status;
      return true;
    },
    onClosed: async (row, status) => void w.notices.push(`closed:${status}:${row.id}`),
    onPaymentFailed: async (row) => void w.notices.push(`failed:${row.id}`),
    seenEvent: async (id) => w.events.has(id),
    recordEvent: async (id) => void w.events.add(id),
  };
}

/** Separate dep sets: the webhook verifier takes (raw, sig), the checkout one (order, payment, sig). */
function webhookDeps(w: World): WebhookDeps {
  return { ...deps(w), verifySignature: (raw, sig) => verifyWebhookSignature(raw, sig) };
}
function checkoutDeps(w: World): CheckoutDeps {
  return { ...deps(w), verifySignature: (o, p, s) => verifyCheckoutSignature(o, p, s) };
}

function webhook(event: string, payload: object): { raw: string; sig: string } {
  const raw = JSON.stringify({ entity: "event", event, payload, created_at: 1 });
  return { raw, sig: sign(WEBHOOK_SECRET, raw) };
}

// ---------------------------------------------------------------------------
// Pricing and config
// ---------------------------------------------------------------------------

test("INR price is the USD price x rate, in paise", () => {
  assert.equal(inrPaise(1, 100), 10_000); // $1 -> ₹100
  assert.equal(inrPaise(10, 100), 100_000); // $10 -> ₹1000
  assert.equal(inrPaise(PLANS.MONTHLY.priceUsd, 100), 10_000);
  assert.equal(inrPaise(PLANS.YEARLY.priceUsd, 100), 100_000);
  assert.equal(inrPaise(1, 83.25), 8_325);
  assert.equal(formatInr(100_000), "₹1,000");
  assert.equal(formatInr(9_950), "₹99.50");
});

test("missing payment env vars are reported by name, never by value", () => {
  const saved = { ...process.env };
  try {
    for (const k of ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET", "RAZORPAY_USD_INR_RATE", "SUPPORT_TELEGRAM"]) delete process.env[k];
    const problems = paymentEnvProblems();
    assert.equal(problems.length, 5);
    assert.ok(problems.every((p) => p.endsWith("is not set")));
    process.env.RAZORPAY_KEY_ID = "rzp_live_ABCDEFGH12";
    process.env.RAZORPAY_KEY_SECRET = "super-secret-value";
    process.env.RAZORPAY_WEBHOOK_SECRET = "x";
    process.env.RAZORPAY_USD_INR_RATE = "abc";
    process.env.SUPPORT_TELEGRAM = "@Valid_Handle";
    const second = paymentEnvProblems();
    assert.deepEqual(second, ["RAZORPAY_USD_INR_RATE must be a positive number, e.g. 100"]);
    assert.ok(!second.join(" ").includes("super-secret-value"));
  } finally {
    process.env = saved;
  }
});

test("log masking keeps only the id prefix and last four characters", () => {
  assert.equal(maskId("pay_ABCDEFGHIJ"), "pay_…GHIJ");
  assert.equal(maskId(null), "-");
});

// ---------------------------------------------------------------------------
// Signatures
// ---------------------------------------------------------------------------

test("valid checkout signature (HMAC-SHA256 of order_id|payment_id) is accepted", () => {
  const sig = sign(KEY_SECRET, "order_ABC123456|pay_XYZ987654");
  assert.equal(verifyCheckoutSignature("order_ABC123456", "pay_XYZ987654", sig), true);
  assert.equal(verifyCheckoutSignature("order_ABC123456", "pay_XYZ987654", sig.toUpperCase()), true);
});

test("tampered checkout signatures are rejected", () => {
  const sig = sign(KEY_SECRET, "order_ABC123456|pay_XYZ987654");
  assert.equal(verifyCheckoutSignature("order_ABC123456", "pay_OTHER00001", sig), false, "other payment");
  assert.equal(verifyCheckoutSignature("order_OTHER0001", "pay_XYZ987654", sig), false, "other order");
  assert.equal(verifyCheckoutSignature("order_ABC123456", "pay_XYZ987654", sign("wrong", "order_ABC123456|pay_XYZ987654")), false);
  assert.equal(verifyCheckoutSignature("order_ABC123456", "pay_XYZ987654", sig.slice(0, 63) + (sig.endsWith("0") ? "1" : "0")), false);
  assert.equal(verifyCheckoutSignature("order_ABC123456", "pay_XYZ987654", ""), false);
  assert.equal(verifyCheckoutSignature("order_ABC123456", "pay_XYZ987654", null), false);
  assert.equal(verifyCheckoutSignature("order_ABC123456", "pay_XYZ987654", "zz".repeat(32)), false);
});

test("webhook signature covers the exact raw body", () => {
  const raw = '{"event":"payment.captured","payload":{}}';
  const sig = sign(WEBHOOK_SECRET, raw);
  assert.equal(verifyWebhookSignature(raw, sig), true);
  assert.equal(verifyWebhookSignature(raw + " ", sig), false, "whitespace change");
  assert.equal(verifyWebhookSignature(raw.replace("captured", "failed"), sig), false);
  assert.equal(verifyWebhookSignature(raw, sign(KEY_SECRET, raw)), false, "key secret is not the webhook secret");
  assert.equal(verifyWebhookSignature(raw, null), false);
});

// ---------------------------------------------------------------------------
// Checkout callback
// ---------------------------------------------------------------------------

test("checkout: valid signature + captured payment activates Premium once", async () => {
  const w = newWorld();
  const row = addRow(w);
  addPayment(w, { id: "pay_GOOD000001", order_id: row.orderId, amount: row.amount });
  const sig = sign(KEY_SECRET, `${row.orderId}|pay_GOOD000001`);
  const res = await confirmCheckout({ orderId: row.orderId, paymentId: "pay_GOOD000001", signature: sig }, checkoutDeps(w));
  assert.equal(res.outcome, "applied");
  assert.equal(w.premiumGrants.length, 1);
  assert.equal(w.rows.get(row.id)!.status, "PAID");
});

test("checkout: tampered signature never reaches Razorpay or activates", async () => {
  const w = newWorld();
  const row = addRow(w);
  addPayment(w, { id: "pay_GOOD000002", order_id: row.orderId, amount: row.amount });
  const bad = sign(KEY_SECRET, `${row.orderId}|pay_GOOD000003`);
  const res = await confirmCheckout({ orderId: row.orderId, paymentId: "pay_GOOD000002", signature: bad }, checkoutDeps(w));
  assert.equal(res.outcome, "bad_signature");
  assert.equal(w.apiCalls, 0);
  assert.equal(w.premiumGrants.length, 0);
});

test("checkout: a frontend 'success' for a payment that isn't captured does not activate", async () => {
  const w = newWorld();
  const row = addRow(w);
  addPayment(w, { id: "pay_AUTH000001", order_id: row.orderId, amount: row.amount, status: "authorized" });
  const sig = sign(KEY_SECRET, `${row.orderId}|pay_AUTH000001`);
  const res = await confirmCheckout({ orderId: row.orderId, paymentId: "pay_AUTH000001", signature: sig }, checkoutDeps(w));
  assert.equal(res.outcome, "pending");
  assert.equal(w.premiumGrants.length, 0);
});

test("checkout: another user's order is not found", async () => {
  const w = newWorld();
  const d = checkoutDeps(w);
  const res = await confirmCheckout(
    { orderId: "order_NOTMINE001", paymentId: "pay_X00000001", signature: "a".repeat(64) },
    { ...d, findOwnRow: async () => null }
  );
  assert.equal(res.outcome, "not_found");
});

// ---------------------------------------------------------------------------
// Amount mismatch
// ---------------------------------------------------------------------------

test("amount mismatch: payment is flagged for review and Premium is not activated", async () => {
  const w = newWorld();
  const row = addRow(w);
  addPayment(w, { id: "pay_CHEAP00001", order_id: row.orderId, amount: 100 }); // ₹1 instead of ₹1000
  const { raw, sig } = webhook("payment.captured", { payment: { entity: { id: "pay_CHEAP00001", order_id: row.orderId, amount: row.amount } } });
  const res = await processWebhook(raw, sig, "evt_amount1", webhookDeps(w));
  // The webhook body claimed the right amount; the API is what counts.
  assert.equal(res.outcome, "flagged");
  assert.equal(w.premiumGrants.length, 0);
  assert.equal(w.rows.get(row.id)!.status, "FLAGGED");
  assert.deepEqual(w.flagged, [{ rowId: row.id, reason: "amount_mismatch" }]);
});

test("currency mismatch and foreign order are never activated", () => {
  const row = { orderId: "order_A00000001", amount: 10_000, currency: "INR" };
  assert.deepEqual(judgePayment(row, { id: "pay_1", order_id: "order_A00000001", amount: 10_000, currency: "USD", status: "captured" }), {
    kind: "flag",
    reason: "currency_mismatch",
  });
  assert.deepEqual(judgePayment(row, { id: "pay_1", order_id: "order_B00000001", amount: 10_000, currency: "INR", status: "captured" }), {
    kind: "reject",
    reason: "order_mismatch",
  });
  assert.equal(judgePayment(row, { id: "pay_1", order_id: "order_A00000001", amount: 10_000, currency: "INR", status: "captured" }).kind, "fulfil");
});

test("payment link whose amount differs from our record is flagged", async () => {
  const w = newWorld();
  const row = addRow(w, { channel: "TELEGRAM", orderId: null, paymentLinkId: "plink_TEST000001", referenceId: "cvt_ref_link1" });
  const { raw, sig } = webhook("payment_link.paid", {
    payment_link: { entity: { id: "plink_TEST000001", amount: 100, currency: "INR", reference_id: "cvt_ref_link1", status: "paid" } },
    payment: { entity: { id: "pay_LINK000001", order_id: "order_LINK000001", amount: 100 } },
  });
  const res = await processWebhook(raw, sig, "evt_link_amt", webhookDeps(w));
  assert.equal(res.outcome, "flagged");
  assert.equal(w.rows.get(row.id)!.status, "FLAGGED");
  assert.equal(w.premiumGrants.length, 0);
});

// ---------------------------------------------------------------------------
// Duplicates and replays
// ---------------------------------------------------------------------------

test("duplicate webhook: a retried event and a second event for the same payment grant Premium once", async () => {
  const w = newWorld();
  const row = addRow(w);
  addPayment(w, { id: "pay_DUP0000001", order_id: row.orderId, amount: row.amount });
  const { raw, sig } = webhook("payment.captured", { payment: { entity: { id: "pay_DUP0000001", order_id: row.orderId } } });
  const d = webhookDeps(w);

  assert.equal((await processWebhook(raw, sig, "evt_dup_1", d)).outcome, "applied");
  assert.equal((await processWebhook(raw, sig, "evt_dup_1", d)).outcome, "duplicate_event", "Razorpay retry");
  const orderPaid = webhook("order.paid", {
    order: { entity: { id: row.orderId } },
    payment: { entity: { id: "pay_DUP0000001", order_id: row.orderId } },
  });
  assert.equal((await processWebhook(orderPaid.raw, orderPaid.sig, "evt_dup_2", d)).outcome, "already_paid");
  // And the checkout callback arriving last.
  const cs = sign(KEY_SECRET, `${row.orderId}|pay_DUP0000001`);
  assert.equal((await confirmCheckout({ orderId: row.orderId, paymentId: "pay_DUP0000001", signature: cs }, checkoutDeps(w))).outcome, "already_paid");
  assert.equal(w.premiumGrants.length, 1);
  assert.equal(w.notices.filter((n) => n.startsWith("applied")).length, 1);
});

test("duplicate webhook: concurrent deliveries still grant once", async () => {
  const w = newWorld();
  const row = addRow(w);
  addPayment(w, { id: "pay_RACE000001", order_id: row.orderId, amount: row.amount });
  const { raw, sig } = webhook("payment.captured", { payment: { entity: { id: "pay_RACE000001", order_id: row.orderId } } });
  const d = webhookDeps(w);
  const results = await Promise.all([processWebhook(raw, sig, null, d), processWebhook(raw, sig, null, d), processWebhook(raw, sig, null, d)]);
  assert.equal(results.filter((r) => r.outcome === "applied").length, 1);
  assert.equal(w.premiumGrants.length, 1);
});

test("replayed payment: a captured payment can't be reused on a second order", async () => {
  const w = newWorld();
  const first = addRow(w, { userId: "victim" });
  const second = addRow(w, { userId: "attacker" });
  addPayment(w, { id: "pay_REPLAY0001", order_id: first.orderId, amount: first.amount });

  const s1 = sign(KEY_SECRET, `${first.orderId}|pay_REPLAY0001`);
  assert.equal((await confirmCheckout({ orderId: first.orderId, paymentId: "pay_REPLAY0001", signature: s1 }, checkoutDeps(w))).outcome, "applied");

  // Replaying the genuine (order, payment, signature) triple against another order fails the signature...
  const replay = await confirmCheckout({ orderId: second.orderId, paymentId: "pay_REPLAY0001", signature: s1 }, checkoutDeps(w));
  assert.equal(replay.outcome, "bad_signature");
  // ...and even a correctly signed pointer is refused: the payment belongs to the first order.
  const s2 = sign(KEY_SECRET, `${second.orderId}|pay_REPLAY0001`);
  const forged = await confirmCheckout({ orderId: second.orderId, paymentId: "pay_REPLAY0001", signature: s2 }, checkoutDeps(w));
  assert.equal(forged.outcome, "rejected");
  assert.equal(forged.reason, "order_mismatch");
  assert.deepEqual(w.premiumGrants, [{ userId: "victim", rowId: first.id }]);
});

test("replayed payment: the unique payment id stops a second row settling", async () => {
  const w = newWorld();
  // Two rows pointing at one order can't exist in the database (unique
  // orderId); simulate the worst case anyway to prove the payment-id gate.
  const a = addRow(w, { orderId: "order_SHARED0001" });
  const b = addRow(w, { orderId: "order_SHARED0001" });
  addPayment(w, { id: "pay_SHARED0001", order_id: "order_SHARED0001", amount: a.amount });
  const d = webhookDeps(w);
  assert.equal((await settle({ ...w.rows.get(a.id)! }, "pay_SHARED0001", d)).outcome, "applied");
  assert.equal((await settle({ ...w.rows.get(b.id)! }, "pay_SHARED0001", d)).outcome, "replayed");
  assert.equal(w.premiumGrants.length, 1);
});

// ---------------------------------------------------------------------------
// Webhook hygiene
// ---------------------------------------------------------------------------

test("webhook with a tampered body or bad signature is rejected before parsing", async () => {
  const w = newWorld();
  const row = addRow(w);
  addPayment(w, { id: "pay_TAMP000001", order_id: row.orderId, amount: row.amount });
  const { raw, sig } = webhook("payment.captured", { payment: { entity: { id: "pay_TAMP000001", order_id: row.orderId } } });
  const tampered = raw.replace("pay_TAMP000001", "pay_TAMP000002");
  assert.equal((await processWebhook(tampered, sig, "evt_t1", webhookDeps(w))).httpStatus, 400);
  assert.equal((await processWebhook(raw, "0".repeat(64), "evt_t2", webhookDeps(w))).httpStatus, 400);
  assert.equal((await processWebhook(raw, null, "evt_t3", webhookDeps(w))).httpStatus, 400);
  assert.equal(w.premiumGrants.length, 0);
  assert.equal(w.apiCalls, 0);
});

test("webhook events for unknown orders are acknowledged and ignored", async () => {
  const w = newWorld();
  const { raw, sig } = webhook("payment.captured", { payment: { entity: { id: "pay_UNKNOWN001", order_id: "order_UNKNOWN01" } } });
  const res = await processWebhook(raw, sig, "evt_u1", webhookDeps(w));
  assert.deepEqual(res, { httpStatus: 200, outcome: "unknown_order" });
  assert.equal(w.apiCalls, 0);
});

test("payment link paid: binds Razorpay's order, verifies via API, activates", async () => {
  const w = newWorld();
  const row = addRow(w, { channel: "TELEGRAM", telegramId: "777", orderId: null, paymentLinkId: "plink_OK00000001", referenceId: "cvt_ref_ok1" });
  addPayment(w, { id: "pay_LINKOK0001", order_id: "order_LINKOK0001", amount: row.amount });
  const { raw, sig } = webhook("payment_link.paid", {
    payment_link: { entity: { id: "plink_OK00000001", amount: row.amount, currency: "INR", reference_id: "cvt_ref_ok1", status: "paid" } },
    payment: { entity: { id: "pay_LINKOK0001", order_id: "order_LINKOK0001" } },
    order: { entity: { id: "order_LINKOK0001" } },
  });
  assert.equal((await processWebhook(raw, sig, "evt_l1", webhookDeps(w))).outcome, "applied");
  assert.equal(w.rows.get(row.id)!.orderId, "order_LINKOK0001");
  // payment.captured for the same payment, arriving afterwards.
  const cap = webhook("payment.captured", { payment: { entity: { id: "pay_LINKOK0001", order_id: "order_LINKOK0001" } } });
  assert.equal((await processWebhook(cap.raw, cap.sig, "evt_l2", webhookDeps(w))).outcome, "already_paid");
  assert.equal(w.premiumGrants.length, 1);
});

// ---------------------------------------------------------------------------
// Expiry
// ---------------------------------------------------------------------------

test("expired link: closes the payment, tells the buyer once, never activates", async () => {
  const w = newWorld();
  const row = addRow(w, { channel: "TELEGRAM", telegramId: "888", orderId: null, paymentLinkId: "plink_EXP0000001", referenceId: "cvt_ref_exp" });
  const ev = webhook("payment_link.expired", { payment_link: { entity: { id: "plink_EXP0000001", status: "expired" } } });
  assert.equal((await processWebhook(ev.raw, ev.sig, "evt_e1", webhookDeps(w))).outcome, "expired");
  assert.equal(w.rows.get(row.id)!.status, "EXPIRED");
  const again = webhook("payment_link.expired", { payment_link: { entity: { id: "plink_EXP0000001", status: "expired" } } });
  assert.equal((await processWebhook(again.raw, again.sig, "evt_e2", webhookDeps(w))).outcome, "ignored_after_final");
  assert.deepEqual(w.notices, [`closed:EXPIRED:${row.id}`]);
  assert.equal(w.premiumGrants.length, 0);
});

test("expired link is never handed out again", () => {
  const now = new Date();
  assert.equal(isReusable({ status: "PENDING", fulfilledAt: null, expiresAt: new Date(now.getTime() + 20 * 60_000) }, now), true);
  assert.equal(isReusable({ status: "PENDING", fulfilledAt: null, expiresAt: new Date(now.getTime() + 60_000) }, now), false, "about to expire");
  assert.equal(isReusable({ status: "PENDING", fulfilledAt: null, expiresAt: new Date(now.getTime() - 1) }, now), false, "expired");
  assert.equal(isReusable({ status: "EXPIRED", fulfilledAt: null, expiresAt: new Date(now.getTime() + 20 * 60_000) }, now), false);
  assert.equal(isReusable({ status: "PAID", fulfilledAt: now, expiresAt: new Date(now.getTime() + 20 * 60_000) }, now), false);
});

test("a cancelled link closes and a failed payment only notifies", async () => {
  const w = newWorld();
  const row = addRow(w, { channel: "TELEGRAM", telegramId: "999", paymentLinkId: "plink_CAN0000001", orderId: "order_CAN0000001" });
  const failed = webhook("payment.failed", { payment: { entity: { id: "pay_FAIL000001", order_id: "order_CAN0000001", status: "failed" } } });
  assert.equal((await processWebhook(failed.raw, failed.sig, "evt_f1", webhookDeps(w))).outcome, "payment_failed");
  assert.equal(w.rows.get(row.id)!.status, "PENDING", "the buyer can retry with the same link");
  const cancelled = webhook("payment_link.cancelled", { payment_link: { entity: { id: "plink_CAN0000001" } } });
  assert.equal((await processWebhook(cancelled.raw, cancelled.sig, "evt_c1", webhookDeps(w))).outcome, "cancelled");
  assert.deepEqual(w.notices, [`failed:${row.id}`, `closed:CANCELLED:${row.id}`]);
  assert.equal(w.premiumGrants.length, 0);
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

test("rate limiting: at most 5 new orders per user per 10 minutes, with a cooldown message", () => {
  const user = `rl-user-${Date.now()}`;
  for (let i = 0; i < CREATE_LIMIT_USER; i++) assert.equal(allowPaymentCreation(user, null).ok, true, `attempt ${i + 1}`);
  const blocked = allowPaymentCreation(user, null);
  assert.equal(blocked.ok, false);
  assert.match((blocked as { error: string }).error, /Too many payment attempts\. Please wait \d+ minutes?/);
});

test("rate limiting: one IP can't cycle through accounts past its own limit", () => {
  const ip = `rl-ip-${Date.now()}`;
  for (let i = 0; i < CREATE_LIMIT_IP; i++) assert.equal(allowPaymentCreation(`acct-${i}-${ip}`, ip).ok, true);
  assert.equal(allowPaymentCreation(`acct-new-${ip}`, ip).ok, false);
});

// ---------------------------------------------------------------------------
// Bot callback data and CSP
// ---------------------------------------------------------------------------

test("bot callback data carries only a plan key; anything else is refused", async () => {
  const { parseRzpCallback } = await import("../src/lib/telegram/premium-screens.ts");
  assert.equal(parseRzpCallback("rz:m"), "MONTHLY");
  assert.equal(parseRzpCallback("rz:y"), "YEARLY");
  assert.equal(parseRzpCallback("rz:back"), "back");
  for (const forged of ["rz:y:1", "rz:y?amount=1", "rz:Y", "rz:", "rz:yearly", undefined, "rz:m ".trim() + "x"]) {
    assert.equal(parseRzpCallback(forged), null, String(forged));
  }
});

test("the CSP allows Razorpay Checkout and only on its own hosts", async () => {
  const { securityHeaders } = await import("../next.config.ts");
  const csp = securityHeaders.find((h) => h.key === "Content-Security-Policy")!.value;
  const dir = (name: string) => csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(name)) ?? "";
  assert.match(dir("script-src"), /https:\/\/checkout\.razorpay\.com/);
  assert.match(dir("frame-src"), /https:\/\/api\.razorpay\.com/);
  assert.doesNotMatch(csp, /\*\.razorpay\.com/);
});
