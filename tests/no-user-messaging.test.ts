import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { NAV_LINKS } from "../src/lib/nav.ts";
import { SITE_COMMUNITY_LINKS } from "../src/lib/community.ts";

/**
 * The website hosts no user-to-user communication (removed 2026-10-29 for
 * Razorpay onboarding: "We do not support platforms with individual chat
 * functionality"). Chat, on-site Premium rooms, course comments and the
 * request board with its comments must stay unreachable. Telegram community
 * channel link and the bot are separate and unaffected.
 *
 * The public Telegram community group (t.me/Unique_One_Chat) is not offered
 * anywhere on the website either (Razorpay, 2026-10-30). The bot still links
 * it through COMMUNITY_LINKS; the site uses SITE_COMMUNITY_LINKS (channel only).
 */

const SRC = join(import.meta.dirname, "..", "src");

const REMOVED = [
  "app/(site)/chat",
  "app/(site)/requests",
  "app/(site)/premium-chats/[id]",
  "app/api/chat",
  "app/api/comments",
  "app/api/course-requests",
  "app/api/notifications",
  "app/api/premium/chats",
  "app/api/upload/chat-image",
  "app/api/upload/request-image",
  "server/actions/chat.ts",
  "server/actions/comments.ts",
  "server/actions/request-comments.ts",
  "server/actions/course-requests.ts",
  "server/actions/notifications.ts",
];

test("user-to-user messaging routes, APIs and actions do not exist", () => {
  for (const path of REMOVED) assert.equal(existsSync(join(SRC, path)), false, `${path} must stay removed`);
});

test("navigation links to no chat or discussion page", () => {
  const hrefs = NAV_LINKS.flatMap((e) => ("children" in e ? e.children.map((c) => c.href) : [e.href]));
  for (const href of hrefs) assert.doesNotMatch(href, /^\/(chat|requests)(\/|$)/, href);
});

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? files(full) : /\.tsx?$/.test(name) ? [full] : [];
  });
}

test("public pages and components never link to the removed features", () => {
  const publicRoots = ["app/(site)", "components/site", "components/premium", "components/account", "components/auth"].map((p) => join(SRC, p));
  for (const file of publicRoots.flatMap(files)) {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /["'`]\/(chat|requests)(["'`/?#])/, `${file} links to a removed page`);
    assert.doesNotMatch(text, /\/api\/(chat|comments|course-requests|notifications)\b/, `${file} calls a removed API`);
    assert.doesNotMatch(text, /\b(to|can) comment\b|live chat|members-only chats?/i, `${file} still advertises messaging`);
  }
});

test("the website offers the Telegram channel but never the public community group", () => {
  assert.deepEqual(SITE_COMMUNITY_LINKS.map((l) => l.url), ["https://t.me/Unique_One_in"]);
  for (const file of ["app", "components"].flatMap((p) => files(join(SRC, p)))) {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /Unique_One_Chat|\bCOMMUNITY_LINKS\b|community group/i, `${file} offers the community group`);
  }
});
