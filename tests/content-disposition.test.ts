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
