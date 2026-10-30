import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isRoutineTelegramFailure } from "../src/lib/telegram/api.ts";

/** Guards for the fixes from the 2026-10-30 production audit. */

const SRC = join(import.meta.dirname, "..", "src");
const ACTIONS = join(SRC, "server", "actions");

/** Splits a server-action file into { name, body } per exported function. */
function exportedActions(file: string): { name: string; body: string }[] {
  const text = readFileSync(file, "utf8");
  const parts = text.split(/^export async function /m).slice(1);
  return parts.map((p) => ({ name: p.slice(0, p.indexOf("(")), body: p.split(/^}/m)[0] }));
}

test("every action that checks a password is rate limited before the comparison", () => {
  let checked = 0;
  for (const name of readdirSync(ACTIONS).filter((n) => n.endsWith(".ts"))) {
    for (const action of exportedActions(join(ACTIONS, name))) {
      const compareAt = action.body.indexOf("bcrypt.compare");
      if (compareAt === -1) continue;
      checked++;
      const limitAt = action.body.search(/checkRateLimit|passwordAttemptAllowed/);
      assert.ok(limitAt !== -1 && limitAt < compareAt, `${name} ${action.name} compares a password without a rate limit`);
    }
  }
  assert.ok(checked >= 2, "expected change-password and delete-account to be checked");
});

test("creating, editing and deleting reviews are rate limited", () => {
  const actions = exportedActions(join(ACTIONS, "reviews.ts"));
  assert.ok(actions.length >= 3);
  for (const a of actions) assert.match(a.body, /reviewWriteAllowed\(user\.id\)/, `${a.name} has no rate limit`);
});

test("a logged-out visit to /account returns there after sign-in", () => {
  const page = readFileSync(join(SRC, "app", "(site)", "account", "page.tsx"), "utf8");
  assert.doesNotMatch(page, /if \(!session\?\.user\?\.id\) redirect\("\/login"\)/);
  assert.match(page, /redirect\("\/login\?next=%2Faccount"\)/);
});

test("routine Telegram failures are recognised, real ones are not", () => {
  assert.equal(isRoutineTelegramFailure(403, "Forbidden: bot was blocked by the user"), true);
  assert.equal(
    isRoutineTelegramFailure(400, "Bad Request: message is not modified: specified new message content and reply markup are exactly the same"),
    true
  );
  assert.equal(isRoutineTelegramFailure(400, "Bad Request: chat not found"), false);
  assert.equal(isRoutineTelegramFailure(429, "Too Many Requests: retry after 5"), false);
  assert.equal(isRoutineTelegramFailure(500, "message is not modified"), false);
});
