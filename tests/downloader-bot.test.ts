import test from "node:test";
import assert from "node:assert/strict";
import {
  downloaderBotHandle,
  downloaderBotUrl,
  downloaderBotUsername,
} from "../src/lib/downloader-bot.ts";

/**
 * Two Telegram bots exist and are easy to confuse:
 *
 *   @Coursevault_in_bot          — CourseVault (courses + Matrix Bots gate)
 *   @You_tubevideodownloader_bot — the social-media downloader shown on /downloader
 *
 * These tests exist so a future edit cannot quietly put the wrong one in front
 * of users on the downloader page.
 */

const COURSEVAULT_BOT = "Coursevault_in_bot";

test("the downloader page advertises the downloader bot", () => {
  assert.equal(downloaderBotUsername(), "You_tubevideodownloader_bot");
  assert.equal(downloaderBotHandle(), "@You_tubevideodownloader_bot");
  assert.equal(downloaderBotUrl(), "https://t.me/You_tubevideodownloader_bot");
});

test("it is never the CourseVault bot", () => {
  for (const value of [downloaderBotUsername(), downloaderBotHandle(), downloaderBotUrl()]) {
    assert.ok(
      !value.toLowerCase().includes(COURSEVAULT_BOT.toLowerCase()),
      `CourseVault bot leaked into the downloader identity: ${value}`,
    );
  }
});

test("the URL is always a t.me link built from a validated username", () => {
  const url = new URL(downloaderBotUrl());
  assert.equal(url.protocol, "https:");
  assert.equal(url.hostname, "t.me");
  assert.match(url.pathname, /^\/[A-Za-z0-9_]{5,32}$/);
});

test("a malformed override is ignored rather than rendered", () => {
  const original = process.env.NEXT_PUBLIC_DOWNLOADER_TELEGRAM_BOT;
  try {
    for (const bad of [
      "bad name",                 // space
      "x",                        // too short
      "a".repeat(40),             // too long
      "evil.com/path",            // not a username
      "javascript:alert(1)",      // scheme injection
      "user?utm=1",               // query injection
      "../../etc/passwd",         // traversal
      "",
    ]) {
      process.env.NEXT_PUBLIC_DOWNLOADER_TELEGRAM_BOT = bad;
      assert.equal(downloaderBotUsername(), "You_tubevideodownloader_bot", `accepted: ${bad}`);
      const url = new URL(downloaderBotUrl());
      assert.equal(url.hostname, "t.me");
    }
  } finally {
    if (original === undefined) delete process.env.NEXT_PUBLIC_DOWNLOADER_TELEGRAM_BOT;
    else process.env.NEXT_PUBLIC_DOWNLOADER_TELEGRAM_BOT = original;
  }
});

test("a valid override is honoured, with or without a leading @", () => {
  const original = process.env.NEXT_PUBLIC_DOWNLOADER_TELEGRAM_BOT;
  try {
    process.env.NEXT_PUBLIC_DOWNLOADER_TELEGRAM_BOT = "@Some_Other_Bot";
    assert.equal(downloaderBotUsername(), "Some_Other_Bot");
    assert.equal(downloaderBotUrl(), "https://t.me/Some_Other_Bot");
  } finally {
    if (original === undefined) delete process.env.NEXT_PUBLIC_DOWNLOADER_TELEGRAM_BOT;
    else process.env.NEXT_PUBLIC_DOWNLOADER_TELEGRAM_BOT = original;
  }
});
