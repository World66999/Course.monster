import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { postJson } from "../src/lib/telegram/transport.ts";
import { formatTiming, runTimed, noteTelegramCall, updateLabel } from "../src/lib/telegram/timing.ts";
import { premiumScreen, RZP_CALLBACK } from "../src/lib/telegram/premium-screens.ts";
import { premiumWelcomeMessage, PREMIUM_BENEFIT_LINES } from "../src/lib/premium-welcome.ts";
import { welcome } from "../src/lib/telegram/render.ts";
import { brandingSchema } from "../src/lib/telegram/branding-schema.ts";
import { NO_REFUND_NOTICE } from "../src/lib/premium-plans.ts";

/** Bot speed work (2026-10-30): connection reuse, timing, and the Premium screens. */

async function server(handler: http.RequestListener): Promise<{ url: string; close: () => Promise<void>; srv: http.Server }> {
  const srv = http.createServer(handler);
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  const { port } = srv.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, srv, close: () => new Promise((r) => srv.close(() => r())) };
}

test("the transport reuses one connection across calls", async () => {
  const sockets = new Set<unknown>();
  const s = await server((req, res) => {
    sockets.add(req.socket);
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true, result: true }));
  });
  try {
    for (let i = 0; i < 4; i++) {
      const r = await postJson(`${s.url}/botX/getMe`, {}, 2000);
      assert.equal(r.status, 200);
      assert.deepEqual(JSON.parse(r.body), { ok: true, result: true });
    }
    assert.equal(sockets.size, 1, "all four calls should share one keep-alive socket");
  } finally {
    s.srv.closeAllConnections();
    await s.close();
  }
});

test("a call on a socket the server already closed is retried once on a fresh one", async () => {
  let calls = 0;
  const s = await server((req, res) => {
    calls++;
    // The first request succeeds; then the server drops the idle socket.
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true, result: calls }));
    if (calls === 1) setImmediate(() => req.socket.destroy());
  });
  try {
    await postJson(`${s.url}/botX/getMe`, {}, 2000);
    await new Promise((r) => setTimeout(r, 50));
    const second = await postJson(`${s.url}/botX/getMe`, {}, 2000);
    assert.equal(JSON.parse(second.body).ok, true);
  } finally {
    s.srv.closeAllConnections();
    await s.close();
  }
});

test("a timeout surfaces as a timed-out transport error", async () => {
  const s = await server(() => {
    /* never answers */
  });
  try {
    await assert.rejects(postJson(`${s.url}/botX/getMe`, {}, 150), (e: Error & { timedOut?: boolean }) => e.timedOut === true);
  } finally {
    s.srv.closeAllConnections();
    await s.close();
  }
});

test("timing labels name the command or button type, never what the user typed", () => {
  assert.equal(updateLabel({ message: { text: "/start course-slug" } }), "cmd:/start");
  assert.equal(updateLabel({ message: { text: "/Courses@SomeBot" } }), "cmd:/courses");
  assert.equal(updateLabel({ message: { text: "my secret search words" } }), "text");
  assert.equal(updateLabel({ callback_query: { data: "c:cmabc123:b1" } }), "button:c");
  assert.equal(updateLabel({ callback_query: { data: "rz:m" } }), "button:rz:m");
  assert.equal(updateLabel({ callback_query: { data: "a:users:2" } }), "button:a:users");
  assert.equal(updateLabel({ callback_query: { data: "<script>" } }), "button:other");
  assert.equal(updateLabel({ pre_checkout_query: {} }), "pre_checkout");
});

test("runTimed records time to first visible feedback and the API calls made", async () => {
  const lines: string[] = [];
  await runTimed(
    "button:b",
    async () => {
      noteTelegramCall("getChatMember", 5);
      await new Promise((r) => setTimeout(r, 20));
      noteTelegramCall("answerCallbackQuery", 7);
      noteTelegramCall("editMessageText", 9);
    },
    (l) => lines.push(l)
  );
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\[telegram\] timing button:b total=\d+ms first=\d+ms api=3\/21ms$/);
  const first = Number(/first=(\d+)ms/.exec(lines[0])![1]);
  assert.ok(first >= 15, "first feedback is the answer, not the earlier membership check");
  assert.equal(formatTiming({ label: "x", totalMs: 1, firstFeedbackMs: null, calls: 0, callMs: 0 }), "[telegram] timing x total=1ms first=-ms api=0/0ms");
});

const inr = { MONTHLY: { label: "₹100" }, YEARLY: { label: "₹1,000" } };

test("the bot's Premium menu: honest benefits, both methods, refund notice, plan keys only", () => {
  const s = premiumScreen("https://courses.monster", { inr, support: { handle: "@support", url: "https://t.me/support" } });
  assert.doesNotMatch(s.text, /chat/i, "on-site chat no longer exists");
  for (const line of PREMIUM_BENEFIT_LINES) assert.ok(s.text.includes(line));
  assert.ok(s.text.includes(NO_REFUND_NOTICE));
  assert.ok(s.text.includes("$10 (₹1,000)") && s.text.includes("$1 (₹100)"));
  const buttons = s.keyboard.flat();
  const callbacks = buttons.filter((b) => b.callback_data).map((b) => b.callback_data);
  assert.deepEqual(callbacks.sort(), [RZP_CALLBACK.MONTHLY, RZP_CALLBACK.YEARLY].sort());
  assert.ok(buttons.some((b) => b.url?.endsWith("plan=YEARLY&method=crypto")));
  assert.ok(buttons.every((b) => b.text.length <= 40), "buttons stay short enough for phones");
  const noInr = premiumScreen("https://courses.monster", { inr: null, support: null });
  assert.equal(noInr.keyboard.flat().filter((b) => b.callback_data).length, 0, "no UPI buttons without INR prices");
});

test("the bot's main menu offers Premium", () => {
  const w = welcome(brandingSchema.parse({}), "https://courses.monster");
  assert.ok(w.keyboard.flat().some((b) => b.callback_data === RZP_CALLBACK.back && /Premium/.test(b.text)));
});

test("the welcome message after purchase states the facts and what is unlocked", () => {
  const m = premiumWelcomeMessage({
    site: "https://courses.monster",
    planName: "Yearly",
    amountLabel: "₹1,000",
    expiresAt: new Date("2027-10-30T08:00:00Z"),
    paymentId: "pay_<b>x",
    supportHandle: "@support",
    returnPath: "/download/some-course",
  });
  assert.match(m.text, /Welcome to Premium/);
  assert.ok(m.text.includes("30 Oct 2027") && m.text.includes("₹1,000") && m.text.includes("Yearly"));
  assert.ok(m.text.includes("pay_&lt;b&gt;x"), "ids are escaped");
  assert.equal(m.keyboard[0][0].url, "https://courses.monster/download/some-course");
  const plain = premiumWelcomeMessage({ site: "https://s", planName: "Monthly", amountLabel: "$1", expiresAt: new Date() });
  assert.ok(!plain.text.includes("Payment ID") && !plain.text.includes("Need help"));
  assert.ok(!plain.keyboard.flat().some((b) => b.text.includes("Continue")));
});
