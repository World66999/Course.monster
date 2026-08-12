import test from "node:test";
import assert from "node:assert/strict";
import {
  detectSourceType,
  hostnameOf,
  isStorableExternalUrl,
  normalizeExternalUrl,
} from "../src/lib/external-resource.ts";

/**
 * These two directories exist to hand visitors an outbound link, so the stored
 * URL and the platform badge next to it are the whole security surface:
 *
 *   - the URL becomes an `href` a visitor clicks,
 *   - the badge is what they judge that link by before clicking.
 *
 * Everything below pins the rules that keep both honest.
 */

// --- Scheme rejection -------------------------------------------------------

test("dangerous and non-https schemes are refused outright", () => {
  const rejected = [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "  javascript:alert(1)  ",
    "java\tscript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "ftp://example.com/x",
    "gopher://example.com/",
    "blob:https://example.com/uuid",
    "tg://resolve?domain=x",
    // http is deliberately refused too: every platform these sections link to
    // serves https, so allowing it could only downgrade a user's connection.
    "http://example.com/",
  ];
  for (const value of rejected) {
    assert.equal(normalizeExternalUrl(value), null, `should have rejected: ${value}`);
    assert.equal(isStorableExternalUrl(value), false, `should have rejected: ${value}`);
  }
});

test("malformed input never throws and never stores", () => {
  for (const value of ["", "   ", "not a url", "://missing-scheme", "https://", "https:///path", "%%%"]) {
    assert.equal(normalizeExternalUrl(value), null, `should have rejected: ${value}`);
  }
});

test("an over-long URL is rejected rather than truncated", () => {
  // Truncating would silently change where the link points — refuse instead.
  const long = `https://example.com/${"a".repeat(2100)}`;
  assert.equal(normalizeExternalUrl(long), null);
});

// --- Authority tricks -------------------------------------------------------

test("credential-bearing URLs are refused", () => {
  // https://drive.google.com@evil.example/ is a request to evil.example, but
  // reads to a human as though it goes to Google.
  for (const value of [
    "https://drive.google.com@evil.example/",
    "https://user:pass@evil.example/",
    "https://mega.nz:token@evil.example/folder",
  ]) {
    assert.equal(normalizeExternalUrl(value), null, `should have rejected: ${value}`);
  }
});

test("non-public and bare hosts are refused", () => {
  for (const value of ["https://localhost/x", "https://intranet/x", "https://a.localhost/x"]) {
    assert.equal(normalizeExternalUrl(value), null, `should have rejected: ${value}`);
  }
});

// --- Normalization ----------------------------------------------------------

test("accepted URLs are canonicalized before storage", () => {
  assert.equal(normalizeExternalUrl("  https://Example.COM/Path  "), "https://example.com/Path");
  // The WHATWG parser strips tab/CR/LF, so a stored value cannot carry a line
  // break into any attribute or header downstream.
  const injected = normalizeExternalUrl("https://example.com/a\r\nSet-Cookie:%20x=1");
  assert.ok(injected && !/[\r\n\t]/.test(injected), "control characters must not survive normalization");
});

test("legitimate resource URLs survive normalization intact", () => {
  for (const value of [
    "https://mega.nz/folder/AbC123#key",
    "https://t.me/somechannel",
    "https://drive.google.com/drive/folders/1a2b3c",
    "https://github.com/torvalds/linux",
    "https://docs.python.org/3/tutorial/index.html",
  ]) {
    const normalized = normalizeExternalUrl(value);
    assert.ok(normalized, `should have accepted: ${value}`);
    assert.equal(new URL(normalized).hostname, new URL(value).hostname);
  }
});

// --- Hostname-verified platform classification ------------------------------

test("the platform badge follows the hostname", () => {
  const cases: Array<[string, string]> = [
    ["https://mega.nz/folder/x", "MEGA"],
    ["https://MEGA.NZ/folder/x", "MEGA"],
    ["https://t.me/channel", "TELEGRAM"],
    ["https://telegram.me/channel", "TELEGRAM"],
    ["https://drive.google.com/file/d/x", "GOOGLE_DRIVE"],
    ["https://docs.google.com/document/d/x", "GOOGLE_DRIVE"],
    ["https://github.com/a/b", "GITHUB"],
    ["https://gist.github.com/a/b", "GITHUB"],
    ["https://www.dropbox.com/s/x", "DROPBOX"],
    ["https://youtu.be/x", "YOUTUBE"],
    ["https://archive.org/details/x", "ARCHIVE_ORG"],
  ];
  for (const [url, expected] of cases) {
    assert.equal(detectSourceType(url), expected, `wrong source for ${url}`);
  }
});

test("a lookalike hostname cannot borrow another platform's badge", () => {
  // This is the case the badge exists to survive: a link that *reads* like
  // MEGA/Telegram/GitHub but resolves somewhere else must fall back to the
  // honest "WEBSITE", never inherit the trusted label.
  const lookalikes = [
    "https://mega.nz.evil.example/folder/x",
    "https://notmega.nz/folder/x",
    "https://t.me.evil.example/channel",
    "https://github.com.phish.example/a/b",
    "https://evil.example/?redirect=https://mega.nz/folder/x",
    "https://evil.example/mega.nz/folder",
    "https://fakegithub.com/a/b",
  ];
  for (const url of lookalikes) {
    assert.equal(detectSourceType(url), "WEBSITE", `lookalike was misclassified: ${url}`);
  }
});

test("subdomains of a recognized platform still match", () => {
  assert.equal(detectSourceType("https://raw.githubusercontent.com/a/b"), "GITHUB");
  assert.equal(detectSourceType("https://foo.sharepoint.com/x"), "ONEDRIVE");
});

test("unknown hosts get the honest fallback, not a guess", () => {
  assert.equal(detectSourceType("https://some-university.edu/notes.pdf"), "WEBSITE");
  assert.equal(detectSourceType("garbage"), "WEBSITE");
});

test("classification ignores everything except the hostname", () => {
  // A title or path claiming "MEGA" must not influence the badge.
  assert.equal(detectSourceType("https://evil.example/mega/telegram/github"), "WEBSITE");
});

// --- Display helper ---------------------------------------------------------

test("hostnameOf strips www and survives bad input", () => {
  assert.equal(hostnameOf("https://www.perplexity.ai/"), "perplexity.ai");
  assert.equal(hostnameOf("https://mega.nz/x"), "mega.nz");
  assert.equal(hostnameOf("nonsense"), null);
});
