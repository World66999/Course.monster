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
  ["https://pinterest.de/pin/1/", "pinterest"],
  ["https://br.pinterest.com/pin/1/", "pinterest"],
  ["https://www.pinterest.com.br/pin/1/", "pinterest"],
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
  // The old pattern was pinterest\.[a-z.]{2,8} -- not an allowlist. It matched
  // any registerable TLD, and because the class contained a dot it also matched
  // a subdomain of an attacker's own domain.
  ["https://pinterest.evil.com/pin/1", "pinterest on an attacker-owned domain"],
  ["https://pinterest.tk/pin/1", "attacker-registerable ccTLD"],
  ["https://pinterest.ml/pin/1", "attacker-registerable ccTLD"],
  ["https://pinterest.zz/pin/1", "non-existent TLD"],
  ["https://pinterest.a.b.c/pin/1", "dotted TLD class abuse"],
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

test("the no-audio note states a fact and never invents a cause", () => {
  // It used to claim "the source didn't publish an audio track". That is true
  // of some media (an Instagram reel whose every rendition really is
  // video-only) and false of others: Facebook holds the audio and serves this
  // server a video-only DASH copy, so the audio exists and simply cannot be
  // fetched from here. Asserting an unverifiable cause is how a warning becomes
  // a wrong answer.
  const note = safeWarning("NO_AUDIO");
  assert.ok(note);
  assert.ok(
    !/source (didn't|did not|doesn't|does not) publish/i.test(note!),
    "must not claim the source has no audio — we cannot know that"
  );
  assert.ok(/retriev/i.test(note!), "must describe what actually happened: nothing could be retrieved");
});

test("no platform carries advice that is no longer true", () => {
  // This briefly told Facebook users to try the Telegram bot, because only the
  // bot's transport could reach Facebook's audio. The downloader now reaches
  // that same transport itself (see bot9 fbbridge), so that advice would send
  // someone to a route already tried on their behalf. A warning that names a
  // remedy has to be re-checked whenever the remedy changes.
  const base = safeWarning("NO_AUDIO");
  for (const p of ["facebook", "instagram", "youtube", "pinterest", "tiktok"]) {
    const note = safeWarning("NO_AUDIO", p);
    assert.equal(note, base, `${p} must not carry stale advice`);
    assert.ok(!/telegram bot/i.test(note!), `${p} must not point at the bot any more`);
  }
});

test("platforms with no better route get no invented advice", () => {
  const base = safeWarning("NO_AUDIO");
  for (const p of ["instagram", "youtube", "pinterest", "tiktok"]) {
    assert.equal(safeWarning("NO_AUDIO", p), base, `${p} must not gain an unfounded suggestion`);
  }
  // An unknown or absent platform is safe too.
  assert.equal(safeWarning("NO_AUDIO", "nonsense"), base);
  assert.equal(safeWarning("NO_AUDIO", null), base);
  assert.equal(safeWarning("NO_AUDIO"), base);
});

test("the platform argument cannot smuggle copy in for an unknown code", () => {
  assert.equal(safeWarning("SOMETHING_NEW", "facebook"), null);
  assert.equal(safeWarning(null, "facebook"), null);
});

test("a host-level platform refusal reads as terminal, not as 'retry later'", () => {
  // TikTok blocks this server's address for every URL. Telling the user to
  // retry into a permanent refusal wastes their time and a worker each time.
  const msg = safeMessage("PLATFORM_UNAVAILABLE");
  assert.ok(!/try again/i.test(msg), "must not invite a retry that cannot succeed");
  assert.ok(/won't help|will not help/i.test(msg), "must say plainly that retrying is futile");
  assert.ok(!msg.includes("PLATFORM_UNAVAILABLE"), "must not echo the internal code");
  // It must stay distinct from the generic per-video failure, which DOES
  // legitimately suggest retrying.
  assert.notEqual(msg, safeMessage("PLATFORM_ERROR"));
  assert.ok(/try again later/i.test(safeMessage("PLATFORM_ERROR")));
});

test("a blocked platform never implies the others are broken", () => {
  assert.ok(/other platforms are unaffected/i.test(safeMessage("PLATFORM_UNAVAILABLE")));
});
