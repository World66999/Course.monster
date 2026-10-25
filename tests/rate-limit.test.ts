import test from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, rateLimitStoreSize, sweepRateLimitStore } from "../src/lib/rate-limit.ts";

/**
 * The limiter's store is process-wide and shared by every caller in the app,
 * which is where its two real defects came from: a sweep that used the calling
 * limiter's own window (so a short-windowed caller pruned a long-windowed one's
 * entries) and no ceiling on the number of keys.
 *
 * These cover the observable contract. Each test uses its own key prefix so the
 * shared store cannot make one test depend on another.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let n = 0;
const key = (name: string) => `test:${name}:${process.pid}:${++n}`;

test("a caller is allowed exactly `limit` requests inside the window", () => {
  const k = key("limit");
  const opts = { limit: 3, windowMs: 60_000 };
  assert.deepEqual(
    [1, 2, 3].map(() => checkRateLimit(k, opts).ok),
    [true, true, true]
  );
  assert.equal(checkRateLimit(k, opts).ok, false);
});

test("remaining counts down and never goes negative", () => {
  const k = key("remaining");
  const opts = { limit: 2, windowMs: 60_000 };
  assert.equal(checkRateLimit(k, opts).remaining, 1);
  assert.equal(checkRateLimit(k, opts).remaining, 0);
  const denied = checkRateLimit(k, opts);
  assert.equal(denied.ok, false);
  assert.equal(denied.remaining, 0);
});

test("a refusal reports how long until the window frees up", () => {
  const k = key("retry-after");
  const opts = { limit: 1, windowMs: 30_000 };
  checkRateLimit(k, opts);
  const denied = checkRateLimit(k, opts);
  assert.equal(denied.ok, false);
  assert.ok(denied.retryAfterMs > 0 && denied.retryAfterMs <= opts.windowMs, String(denied.retryAfterMs));
});

test("allowance returns once the window has passed", async () => {
  const k = key("expiry");
  const opts = { limit: 1, windowMs: 60 };
  assert.equal(checkRateLimit(k, opts).ok, true);
  assert.equal(checkRateLimit(k, opts).ok, false);
  await sleep(90);
  assert.equal(checkRateLimit(k, opts).ok, true);
});

test("keys are independent — one caller's limit is not another's", () => {
  const a = key("iso-a");
  const b = key("iso-b");
  const opts = { limit: 1, windowMs: 60_000 };
  assert.equal(checkRateLimit(a, opts).ok, true);
  assert.equal(checkRateLimit(a, opts).ok, false);
  assert.equal(checkRateLimit(b, opts).ok, true);
});

test("a sweep does not shorten a window longer than the sweep's own floor", () => {
  // The regression this covers: the sweep pruned entries older than
  // max(callingLimiter.windowMs, 15 minutes), so any limiter whose window was
  // *longer* than fifteen minutes had its bucket trimmed back to fifteen by
  // traffic on any other endpoint. The newsletter limit is five per hour, and
  // in practice it was five per quarter-hour.
  //
  // Driven explicitly rather than by waiting: the real gap is twenty minutes,
  // and the periodic sweep is on a five-minute timer.
  const slow = key("slow-hour");
  const hour = { limit: 1, windowMs: 60 * 60_000 };

  assert.equal(checkRateLimit(slow, hour).ok, true, "the first request should be allowed");

  // Twenty minutes later: past the old fifteen-minute floor, well inside the
  // hour this limiter actually asked for.
  sweepRateLimitStore(Date.now() + 20 * 60_000);

  assert.equal(
    checkRateLimit(slow, hour).ok,
    false,
    "the sweep forgot a request still inside its own one-hour window"
  );
});

test("a sweep drops what has genuinely expired", async () => {
  const k = key("expired-sweep");
  checkRateLimit(k, { limit: 1, windowMs: 10 });
  const before = rateLimitStoreSize();
  await sleep(30);
  // Sweeping uses the widest window any caller has asked for, so this only
  // drops the key once that window has also passed for it.
  sweepRateLimitStore(Date.now() + 60 * 60_000);
  assert.ok(rateLimitStoreSize() < before, "expired buckets were not released");
});

test("the store has a ceiling, and holding it stays cheap", () => {
  // Two things at once, because the second is what the first can break. A
  // ceiling that evicts to exactly the ceiling makes every request past it run
  // another full O(n) sweep: the first version of this took 271 seconds for the
  // loop below. The time bound is deliberately generous — it is there to catch
  // quadratic behaviour, not to measure the machine.
  const opts = { limit: 1, windowMs: 60_000 };
  const started = Date.now();
  for (let i = 0; i < 60_000; i++) {
    checkRateLimit(`test:flood:${process.pid}:${i}`, opts);
  }
  const elapsed = Date.now() - started;
  assert.ok(rateLimitStoreSize() <= 50_000, `store grew to ${rateLimitStoreSize()}`);
  assert.ok(elapsed < 20_000, `holding the ceiling took ${elapsed}ms — sweeping is not amortised`);
});
