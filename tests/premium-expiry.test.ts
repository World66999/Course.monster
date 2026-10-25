import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { hasExpired, isActiveUntil, periodEnd, periodStart } from "../src/lib/premium-period.ts";
import {
  consumeDownloadToken,
  createDownloadToken,
  createHandoffToken,
  verifyHandoffToken,
} from "../src/lib/download-token.ts";
import { safeReturnPath } from "../src/lib/return-path.ts";

/**
 * Premium time arithmetic and the tokens that carry Premium access outside a
 * page request. Time is moved with a fake clock, never waited for.
 */

process.env.DOWNLOAD_TOKEN_SECRET = "test-download-secret";

const d = (iso: string) => new Date(iso);
const MONTH = 1;
const YEAR = 12;

/** What addPremiumPeriod does: start at the current expiry if active, else now. */
function activate(currentUntil: Date | null, months: number, now: Date): Date {
  return periodEnd(periodStart(currentUntil, now), months);
}

// --- periods -----------------------------------------------------------------

test("Monthly is exactly one calendar month from activation, to the minute", () => {
  assert.deepEqual(activate(null, MONTH, d("2026-03-10T14:05:00Z")), d("2026-04-10T14:05:00Z"));
  assert.deepEqual(activate(null, MONTH, d("2026-12-15T00:00:00Z")), d("2027-01-15T00:00:00Z"), "across a year end");
});

test("Monthly from the 31st ends on the last day of a shorter month, never spilling over", () => {
  assert.deepEqual(activate(null, MONTH, d("2027-01-31T09:00:00Z")), d("2027-02-28T09:00:00Z"));
  assert.deepEqual(activate(null, MONTH, d("2028-01-31T09:00:00Z")), d("2028-02-29T09:00:00Z"), "leap year");
});

test("Yearly is exactly one year from activation, including from a leap day", () => {
  assert.deepEqual(activate(null, YEAR, d("2026-10-25T08:30:00Z")), d("2027-10-25T08:30:00Z"));
  assert.deepEqual(activate(null, YEAR, d("2028-02-29T12:00:00Z")), d("2029-02-28T12:00:00Z"));
});

test("a renewal while active stacks on top of the current expiry", () => {
  const paid = d("2026-01-10T10:00:00Z");
  const until = activate(null, MONTH, paid); // 10 Feb
  // Renew Monthly on 1 Feb: 9 days still left, so it ends 10 Mar, not 1 Mar.
  assert.deepEqual(activate(until, MONTH, d("2026-02-01T10:00:00Z")), d("2026-03-10T10:00:00Z"));
  // Then Yearly on top of that.
  assert.deepEqual(activate(d("2026-03-10T10:00:00Z"), YEAR, d("2026-02-02T00:00:00Z")), d("2027-03-10T10:00:00Z"));
});

test("a renewal right after expiry starts from the payment, not the old expiry", () => {
  const until = d("2026-02-10T10:00:00Z");
  const now = d("2026-02-10T10:00:01Z"); // one second late
  assert.equal(isActiveUntil(until, now), false);
  assert.deepEqual(activate(until, MONTH, now), d("2026-03-10T10:00:01Z"));
  // Exactly at the expiry instant the old period is already over.
  assert.deepEqual(periodStart(until, until), until);
  assert.equal(isActiveUntil(until, until), false);
});

test("with a moving clock: active for the whole month, expired the moment it passes", () => {
  mock.timers.enable({ apis: ["Date"], now: d("2026-05-31T23:00:00Z") });
  try {
    const until = activate(null, MONTH, new Date()); // 30 Jun 23:00
    assert.deepEqual(until, d("2026-06-30T23:00:00Z"));
    assert.equal(isActiveUntil(until), true);
    mock.timers.tick(29 * 86_400_000); // 29 Jun
    assert.equal(isActiveUntil(until), true, "a day before the end");
    mock.timers.tick(86_400_000 - 1); // 30 Jun 22:59:59.999
    assert.equal(isActiveUntil(until), true, "last millisecond");
    mock.timers.tick(1);
    assert.equal(isActiveUntil(until), false, "at the expiry instant");
    assert.equal(hasExpired(until), true);
  } finally {
    mock.timers.reset();
  }
});

test("yearly with a moving clock expires at exactly one year", () => {
  mock.timers.enable({ apis: ["Date"], now: d("2026-10-25T08:00:00Z") });
  try {
    const until = activate(null, YEAR, new Date());
    mock.timers.setTime(d("2027-10-25T07:59:59Z").getTime());
    assert.equal(isActiveUntil(until), true);
    mock.timers.setTime(d("2027-10-25T08:00:00Z").getTime());
    assert.equal(isActiveUntil(until), false);
  } finally {
    mock.timers.reset();
  }
});

test("hasExpired is only for accounts that had Premium", () => {
  assert.equal(hasExpired(null), false);
  assert.equal(hasExpired(d("2999-01-01T00:00:00Z")), false);
  assert.equal(hasExpired(d("2000-01-01T00:00:00Z")), true);
});

// --- direct download tokens --------------------------------------------------

test("direct /go tokens carry the user they were minted for", () => {
  const t = createDownloadToken("course1", "iphash", undefined, { direct: true, userId: "user1" });
  const r = consumeDownloadToken(t, "iphash");
  assert.ok(r.ok);
  assert.equal(r.direct, true);
  assert.equal(r.userId, "user1");
  const free = consumeDownloadToken(createDownloadToken("course1", "iphash"), "iphash");
  assert.ok(free.ok);
  assert.equal(free.direct, false);
  assert.equal(free.userId, null);
});

test("the user id inside a /go token can't be swapped", () => {
  const t = createDownloadToken("course1", "iphash", undefined, { direct: true, userId: "user1" });
  const [data, sig] = t.split(".");
  const payload = JSON.parse(Buffer.from(data, "base64url").toString());
  payload.uid = "user2";
  const forged = `${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${sig}`;
  assert.deepEqual(consumeDownloadToken(forged, "iphash"), { ok: false, reason: "invalid" });
});

// --- bot hand-off tokens -----------------------------------------------------

test("hand-off tokens name the user and course and expire after 10 minutes", () => {
  const now = Date.now();
  const t = createHandoffToken("user1", "course1", "777001", now);
  assert.deepEqual(verifyHandoffToken(t, now + 9 * 60_000), {
    ok: true,
    userId: "user1",
    courseId: "course1",
    telegramUserId: "777001",
  });
  assert.deepEqual(verifyHandoffToken(t, now + 10 * 60_000 + 1), { ok: false, reason: "expired" });
});

test("hand-off and /go tokens can't be used in place of each other", () => {
  const goToken = createDownloadToken("course1", "iphash", undefined, { direct: true, userId: "user1" });
  assert.deepEqual(verifyHandoffToken(goToken), { ok: false, reason: "invalid" });
  const handoff = createHandoffToken("user1", "course1", "777001");
  assert.equal(consumeDownloadToken(handoff, "iphash").ok, false);
});

test("a tampered hand-off token is refused", () => {
  const t = createHandoffToken("user1", "course1", "777001");
  assert.equal(verifyHandoffToken(t.slice(0, -2) + "xx").ok, false);
  assert.equal(verifyHandoffToken("nope").ok, false);
});

// --- skip-ads return path ----------------------------------------------------

test("only same-site pages Premium unlocks are kept as the return path", () => {
  assert.equal(safeReturnPath("/download/react-masterclass"), "/download/react-masterclass");
  assert.equal(safeReturnPath("/courses/react-masterclass"), "/courses/react-masterclass");
  assert.equal(safeReturnPath("/premium-resources"), "/premium-resources");
  for (const bad of [
    null,
    "",
    "https://evil.example/download/x",
    "//evil.example/download/x",
    "/\\evil.example",
    "/download/../admin",
    "/download/x?y=1",
    "/account",
    "/download/",
    "/download/UPPER",
  ]) {
    assert.equal(safeReturnPath(bad), null, String(bad));
  }
});
