import test from "node:test";
import assert from "node:assert/strict";

/**
 * Payment links show the site's brand (options.checkout.name) instead of the
 * account's registered name. Display only: every money field is unchanged.
 * fetch is stubbed — no network, throwaway credentials.
 */

import { createPaymentLink } from "../src/lib/razorpay.ts";

// Read lazily by razorpay-config at request time, so setting them here is enough.
process.env.RAZORPAY_KEY_ID = "rzp_test_dummy";
process.env.RAZORPAY_KEY_SECRET = "dummy_secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "dummy_webhook";
delete process.env.RAZORPAY_API_BASE;

type Sent = { url: string; body: Record<string, unknown> };

function stubFetch(sent: Sent[]) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    sent.push({ url: String(url), body });
    return new Response(
      JSON.stringify({
        id: "plink_TESTabc123",
        short_url: "https://rzp.io/rzp/abc123",
        amount: body.amount,
        currency: "INR",
        reference_id: body.reference_id,
        status: "created",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

const base = {
  amount: 19900,
  referenceId: "cvt_0123456789abcdef01234567",
  description: "Courses Monster Premium — Monthly (1 month).",
  expireBy: new Date(1_900_000_000_000),
  notes: { ref: "cvt_0123456789abcdef01234567", plan: "monthly", uid: "u1", telegram_id: "42" },
};

test("payment link carries the brand as checkout name and keeps every money field", async () => {
  const sent: Sent[] = [];
  const restore = stubFetch(sent);
  try {
    const link = await createPaymentLink({ ...base, checkoutName: "Courses Monster" });
    assert.equal(link.id, "plink_TESTabc123");
    assert.equal(sent.length, 1);
    assert.match(sent[0].url, /\/payment_links$/);
    const b = sent[0].body;
    assert.deepEqual(b.options, { checkout: { name: "Courses Monster" } });
    assert.equal(b.amount, 19900);
    assert.equal(b.currency, "INR");
    assert.equal(b.accept_partial, false);
    assert.equal(b.reference_id, base.referenceId);
    assert.equal(b.expire_by, 1_900_000_000);
    assert.deepEqual(b.notes, base.notes);
    assert.deepEqual(b.notify, { sms: false, email: false });
    assert.equal(b.callback_url, undefined);
  } finally {
    restore();
  }
});

test("without a checkout name the request body is exactly the old one", async () => {
  const sent: Sent[] = [];
  const restore = stubFetch(sent);
  try {
    await createPaymentLink(base);
    await createPaymentLink({ ...base, checkoutName: "   " });
    for (const s of sent) {
      assert.equal("options" in s.body, false);
      assert.deepEqual(Object.keys(s.body).sort(), [
        "accept_partial", "amount", "currency", "description", "expire_by", "notes", "notify",
        "reference_id", "reminder_enable",
      ]);
    }
  } finally {
    restore();
  }
});

test("the checkout name is capped at 60 characters", async () => {
  const sent: Sent[] = [];
  const restore = stubFetch(sent);
  try {
    await createPaymentLink({ ...base, checkoutName: "X".repeat(80) });
    assert.equal((sent[0].body.options as { checkout: { name: string } }).checkout.name.length, 60);
  } finally {
    restore();
  }
});
