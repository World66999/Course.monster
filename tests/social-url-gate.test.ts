import test from "node:test";
import assert from "node:assert/strict";
import { detectPlatform, safeMessage, safeWarning } from "../src/lib/social-download.ts";

/**
 * The downloader's URL gate.
 *
 * `detectPlatform` is the first thing an anonymous, attacker-controlled URL
 * meets on its way to a process that will fetch it and follow redirects. Bot9's
 * `links.detect_platform` is the authoritative second gate, but this one decides
 * what leaves the website at all — and it had no test coverage whatsoever.
 *
 * Two failure directions matter and both are covered here, because they pull
 * against each other:
 *
 *   - too permissive → SSRF. Anything that reaches an internal address, a
 *     non-http scheme, or a lookalike host must be refused.
 *   - too strict → a downloader that rejects ordinary links. Hyphens and
 *     underscores are in the base64url alphabet YouTube and Instagram use for
 *     ids and appear in most Facebook page slugs, so refusing them would break
 *     a large share of real URLs while looking like "unsupported link".
 *
 * The control-character cases are deliberate: that check was written with
 * literal 0x00/0x1f BYTES in the source, invisible in an editor and in review.
 * These assertions pin the behaviour so it cannot be silently lost if someone
 * ever reformats or retypes that line.
 */

const ACCEPTED: [string, string][] = [
  ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube"],
  ["https://www.youtube.com/watch?v=abc-def_123", "youtube"],
  ["https://youtu.be/xY-1234abcd", "youtube"],
  ["https://m.youtube.com/watch?v=abc", "youtube"],
  ["https://www.instagram.com/reel/C-AbCdEfGhI/", "instagram"],
  ["https://www.facebook.com/some-page-name/videos/123", "facebook"],
  ["https://fb.watch/a-b-c/", "facebook"],
  ["https://vm.tiktok.com/ZM-abc123/", "tiktok"],
  ["https://www.tiktok.com/@user/video/7300000000000000000", "tiktok"],
  ["https://pin.it/abc-def", "pinterest"],
  ["https://www.pinterest.co.uk/pin/1477812373602736/", "pinterest"],
  // Case and a trailing root dot are normalised, not rejected.
  ["https://WWW.YouTube.com/watch?v=abc", "youtube"],
  ["https://www.youtube.com./watch?v=abc", "youtube"],
];

const REJECTED: [string, string][] = [
  // Scheme
  ["javascript:alert(1)", "javascript scheme"],
  ["data:text/html,<script>alert(1)</script>", "data scheme"],
  ["file:///etc/passwd", "file scheme"],
  ["gopher://127.0.0.1:6379/_INFO", "gopher scheme"],
  ["vbscript:msgbox(1)", "vbscript scheme"],
  ["tg://resolve?domain=x", "tg scheme"],
  // Internal / non-public targets
  ["https://127.0.0.1/x", "loopback ipv4"],
  ["https://[::1]/x", "loopback ipv6"],
  ["https://169.254.169.254/latest/meta-data/", "link-local metadata endpoint"],
  ["https://10.0.0.5/x", "private ipv4"],
  ["https://192.168.1.1/x", "private ipv4"],
  ["https://localhost/x", "bare host"],
  // Authority tricks
  ["https://user:pw@www.youtube.com/x", "embedded credentials"],
  ["https://www.youtube.com@evil.example/x", "credential-style host confusion"],
  ["https://www.youtube.com:8080/x", "explicit port"],
  // Lookalike hosts — suffix matching would let these through
  ["https://youtube.com.evil.com/x", "suffix lookalike"],
  ["https://notyoutube.com/x", "prefix lookalike"],
  ["https://pinterest.com.attacker.net/pin/1", "pinterest suffix lookalike"],
  ["https://evil.example/x", "unknown host"],
  // Whitespace and C0 control characters (CRLF / null-byte injection)
  ["https://www.youtube.com/watch?v=a b", "space"],
  ["https://www.youtube.com/watch?v=a\u0000b", "NUL byte"],
  ["https://www.youtube.com/watch?v=a\u001fb", "0x1f control byte"],
  ["https://www.youtube.com/watch?v=a\rb", "carriage return"],
  ["https://www.youtube.com/watch?v=a\nb", "line feed"],
  ["https://www.youtube.com/watch?v=a\tb", "tab"],
  // Shape
  ["", "empty string"],
  ["not a url", "unparseable"],
  ["//www.youtube.com/watch?v=abc", "protocol-relative"],
];

test("ordinary platform URLs are accepted, hyphens and underscores included", () => {
  for (const [url, expected] of ACCEPTED) {
    assert.equal(detectPlatform(url), expected, `${url} should be ${expected}`);
  }
});

test("every SSRF, scheme, lookalike and control-character vector is refused", () => {
  for (const [url, why] of REJECTED) {
    assert.equal(detectPlatform(url), null, `${JSON.stringify(url)} must be refused (${why})`);
  }
});

test("a URL longer than the cap is refused rather than truncated", () => {
  const long = `https://www.youtube.com/watch?v=${"a".repeat(2100)}`;
  assert.equal(detectPlatform(long), null);
});

test("non-string input never throws", () => {
  for (const bad of [null, undefined, 42, {}, [], true]) {
    assert.equal(detectPlatform(bad as unknown as string), null);
  }
});

test("user-facing errors never echo an internal code", () => {
  // An unknown code must still produce human copy, never the raw token.
  const unknown = safeMessage("SOME_INTERNAL_THING");
  assert.ok(!unknown.includes("SOME_INTERNAL_THING"));
  assert.ok(unknown.length > 0);
  assert.equal(safeMessage(null), safeMessage("PLATFORM_ERROR"));
});

test("warnings are looked up, never echoed, and absent by default", () => {
  assert.equal(safeWarning(null), null);
  assert.equal(safeWarning(undefined), null);
  // An unrecognised warning code is dropped rather than shown to the user.
  assert.equal(safeWarning("SOMETHING_NEW"), null);
  const note = safeWarning("NO_AUDIO");
  assert.ok(note && /no sound/i.test(note), "NO_AUDIO must explain the silence in plain words");
});
