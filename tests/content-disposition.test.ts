import test from "node:test";
import assert from "node:assert/strict";
import { contentDisposition } from "../src/lib/content-disposition.ts";

/**
 * Regression tests for the Facebook "download button does nothing" bug.
 *
 * Root cause: platform titles are not ASCII. A Facebook video titled in Bengali
 * produced a filename of U+09xx codepoints; interpolating it into
 * Content-Disposition made `new Headers()` throw, the route 500'd, and no
 * download ever started. These tests hold the header to the one rule that
 * actually matters — it must always be constructible.
 */

/** The exact filename from the production job that failed. */
const BENGALI =
  "12K views  6.9K reactions  সব ভলবস পরম নয  love viral trending explorepage explore instagram fyp instagood love reels li.mp4";

function assertLegalHeader(value: string) {
  // The real failure mode: Headers rejects any codepoint above 255.
  assert.doesNotThrow(() => new Headers({ "Content-Disposition": value }));
  assert.ok(!/[\r\n]/.test(value), "header must not contain CR or LF");
}

test("the Bengali Facebook filename produces a constructible header", () => {
  const value = contentDisposition(BENGALI);
  assertLegalHeader(value);
  assert.match(value, /^attachment; filename="/);
  assert.match(value, /filename\*=UTF-8''/);
});

test("the real UTF-8 name survives in filename* so the user still sees it", () => {
  const value = contentDisposition(BENGALI);
  const encoded = value.split("filename*=UTF-8''")[1];
  assert.equal(decodeURIComponent(encoded), BENGALI);
});

test("ASCII names are unchanged in the plain filename parameter", () => {
  const value = contentDisposition("Galaxy S26 Ultra - Should You Upgrade.mp4");
  assertLegalHeader(value);
  assert.ok(value.includes('filename="Galaxy S26 Ultra - Should You Upgrade.mp4"'));
});

test("a wholly non-ASCII title keeps its extension rather than becoming a bare 'mp4'", () => {
  const value = contentDisposition("সম্পূর্ণ বাংলা.mp4");
  assertLegalHeader(value);
  assert.ok(value.includes('filename="download.mp4"'), value);
});

test("quote injection cannot escape the quoted filename", () => {
  const value = contentDisposition('evil"; filename="payload.exe');
  assertLegalHeader(value);
  // Exactly one quoted filename parameter survives.
  assert.equal(value.match(/filename="/g)?.length, 1);
  assert.ok(!value.includes('"payload.exe'), value);
});

test("CRLF injection cannot split the header", () => {
  const value = contentDisposition("bad\r\nX-Injected: yes.mp4");
  assertLegalHeader(value);
  assert.ok(!value.toLowerCase().includes("x-injected:\n"));
});

test("missing or empty names fall back to a usable default", () => {
  for (const input of [null, undefined, "", "   "]) {
    const value = contentDisposition(input as string | null | undefined);
    assertLegalHeader(value);
    assert.ok(value.includes('filename="download'), `${input}: ${value}`);
  }
});

test("absurdly long names are bounded", () => {
  const value = contentDisposition("A".repeat(5000) + ".mp4");
  assertLegalHeader(value);
  assert.ok(value.length < 1200, `header too long: ${value.length}`);
});

test("every stored production filename yields a legal header", () => {
  // Names taken verbatim from real completed jobs across all five platforms.
  const realNames = [
    "Galaxy S26 Ultra Vs S25 Ultra - Should You Upgrade.mp4",
    "180K views  2.9K reactions  Best Laptop Best price story love instagram storywa quotes detik art literasi life instagood.mp4",
    "136K views  4.2K reactions  দরতব যখন ভলবসর কছ হর মন  viral trending explorepage explore instagram fyp instagood love ree.mp4",
    "Video by mosseri.mp4",
    "Video by peterdinklageactor.jpg",
    "how many frogs did you find  check out tiktoks Minecraft communit.mp4",
    "How to take incredible travel photos.mp4",
    "Earth Day Recycling Myths.mp4",
  ];
  for (const name of realNames) assertLegalHeader(contentDisposition(name));
});

test("the ascii filename never carries path information", () => {
  // RFC 6266: the filename is a bare name, not a path. Bot9's _safe_name
  // already strips separators before this is ever called, so these inputs are
  // unreachable through the download route -- the helper is hardened on its own
  // terms so it stays correct if it is ever reused somewhere less careful.
  for (const evil of [
    "../../../etc/passwd",
    "..\\..\\windows\\system32\\cmd.exe",
    "/absolute/path/video.mp4",
    "dir/sub/clip.mp4",
  ]) {
    const header = contentDisposition(evil);
    const ascii = /filename="([^"]*)"/.exec(header)?.[1] ?? "";
    assert.ok(!ascii.includes("/"), `forward slash survived: ${ascii}`);
    assert.ok(!ascii.includes("\\"), `backslash survived: ${ascii}`);
    assert.ok(ascii.length > 0, "must still yield a usable name");
  }
});

test("no input can split the header or add a second directive", () => {
  for (const evil of [
    'a";\r\nSet-Cookie: evil=1\r\n\r\n.mp4',
    'a"; filename="pwned.exe',
    "a\r\nX-Injected: 1.mp4",
    "a\u0000evil.mp4",
    "\u202Egnp.exe.mp4",
  ]) {
    const header = contentDisposition(evil);
    assert.ok(!/[\r\n]/.test(header), "header must never contain CR or LF");
    // Exactly one of each directive, and every byte must be header-legal.
    assert.equal((header.match(/filename\*=/g) ?? []).length, 1);
    assert.doesNotThrow(() => new Headers({ "Content-Disposition": header }));
  }
});
