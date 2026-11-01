import test from "node:test";
import assert from "node:assert/strict";
import {
  effectiveDailyLimit,
  extractShortUrl,
  fallbackChain,
  istDay,
  nextIstMidnight,
  providerForSlot,
  usedToday,
} from "../src/lib/shortener-core.ts";
import { consumeDownloadToken, createDownloadToken } from "../src/lib/download-token.ts";

process.env.DOWNLOAD_TOKEN_SECRET = "test-download-secret";

test("the day's unlocks rotate VPLink → GPLinks → LinkShortify", () => {
  assert.equal(providerForSlot(1), "vplink");
  assert.equal(providerForSlot(2), "gplinks");
  assert.equal(providerForSlot(3), "linkshortify");
  assert.equal(providerForSlot(4), "vplink", "a raised limit keeps rotating");
});

test("a failed shortener falls through to the next one, VPLink last", () => {
  const all = { gplinks: true, linkshortify: true };
  assert.deepEqual(fallbackChain("vplink", all), ["vplink", "gplinks", "linkshortify"]);
  assert.deepEqual(fallbackChain("gplinks", all), ["gplinks", "linkshortify", "vplink"]);
  assert.deepEqual(fallbackChain("linkshortify", all), ["linkshortify", "gplinks", "vplink"]);
});

test("a shortener switched off in admin is skipped", () => {
  assert.deepEqual(fallbackChain("gplinks", { gplinks: false, linkshortify: true }), ["linkshortify", "vplink"]);
  assert.deepEqual(fallbackChain("linkshortify", { gplinks: false, linkshortify: false }), ["vplink"]);
});

test("only {status: success, shortenedUrl} counts as a shortened link", () => {
  assert.equal(
    extractShortUrl('{"status":"success","message":"","shortenedUrl":"https:\\/\\/gplinks.co\\/abc"}'),
    "https://gplinks.co/abc"
  );
  assert.equal(extractShortUrl('{"status":"error","message":"bad token","shortenedUrl":""}'), null);
  assert.equal(extractShortUrl('{"status":"success","shortenedUrl":"javascript:alert(1)"}'), null);
  assert.equal(extractShortUrl("<html>Cloudflare</html>"), null);
  assert.equal(extractShortUrl('{"shortenedUrl":"https://vplink.in/x"}'), "https://vplink.in/x");
});

test("the day resets at midnight India time, not server or UTC midnight", () => {
  // 18:29 UTC = 23:59 IST on the 1st; 18:30 UTC = 00:00 IST on the 2nd.
  assert.equal(istDay(new Date("2026-11-01T18:29:59Z")), "2026-11-01");
  assert.equal(istDay(new Date("2026-11-01T18:30:00Z")), "2026-11-02");
  assert.equal(istDay(new Date("2026-11-01T02:00:00Z")), "2026-11-01");
  assert.deepEqual(nextIstMidnight(new Date("2026-11-01T10:00:00Z")), new Date("2026-11-01T18:30:00Z"));
  assert.deepEqual(nextIstMidnight(new Date("2026-11-01T18:30:00Z")), new Date("2026-11-02T18:30:00Z"));
});

test("yesterday's count is today's zero", () => {
  assert.equal(usedToday({ day: "2026-11-01", count: 3 }, "2026-11-02"), 0);
  assert.equal(usedToday({ day: "2026-11-02", count: 2 }, "2026-11-02"), 2);
  assert.equal(usedToday(null, "2026-11-02"), 0);
});

test("daily limit: admin value, else FREE_DAILY_COURSE_LIMIT, else 3", () => {
  assert.equal(effectiveDailyLimit(5, "3"), 5);
  assert.equal(effectiveDailyLimit(null, "4"), 4);
  assert.equal(effectiveDailyLimit(null, undefined), 3);
  assert.equal(effectiveDailyLimit(null, "abc"), 3);
});

test("/go tokens carry the unlock attempt and the reopen subject, signed", () => {
  const t = createDownloadToken("course1", "ip1", undefined, { unlockSessionId: "sess1" });
  const r = consumeDownloadToken(t, "ip1");
  assert.ok(r.ok && r.unlockSessionId === "sess1" && r.reopenSubject === null && !r.direct);

  const t2 = createDownloadToken("course1", "ip1", undefined, { reopenSubject: "tg:42" });
  const r2 = consumeDownloadToken(t2, "ip1");
  assert.ok(r2.ok && r2.reopenSubject === "tg:42" && r2.unlockSessionId === null);

  // Tampering with the payload breaks the signature.
  const [data, sig] = t2.split(".");
  const forged = Buffer.from(
    JSON.stringify({ ...JSON.parse(Buffer.from(data!, "base64url").toString()), ro: "tg:1" })
  ).toString("base64url");
  assert.equal(consumeDownloadToken(`${forged}.${sig}`, "ip1").ok, false);
});
