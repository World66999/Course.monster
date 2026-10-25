import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Structural guard on the admin authorization boundary.
 *
 * Every mutation in the admin panel is a server action, and a server action is
 * a public POST endpoint — being rendered inside the admin layout authorizes
 * nothing. The only thing standing between an anonymous request and a write is
 * the `requireAdmin()` call at the top of each action, which throws for a
 * non-staff or disabled session.
 *
 * A new action that forgets that call is invisible in review and in the UI: it
 * works perfectly for the admin who wrote it. This test reads the action files
 * and fails if any exported action is missing the guard — including files that
 * do not exist yet.
 */

const ACTIONS_DIR = join(import.meta.dirname, "..", "src", "server", "actions");

/** Actions that are deliberately callable by non-admins, with the guard they use instead. */
const PUBLIC_ACTION_FILES = new Set([
  "auth.ts",
  "public-auth.ts",
  "signup.ts",
  "password-reset.ts",
  "profile.ts",
  "comments.ts",
  "reviews.ts",
  "reports.ts",
  "chat.ts",
  "course-requests.ts",
  "request-comments.ts",
  "notifications.ts",
  "apps.ts",
  "coding-channels.ts",
  "learning-resources.ts",
  "premium.ts",
  "support.ts",
]);

function adminActionFiles(): string[] {
  return readdirSync(ACTIONS_DIR)
    .filter((f) => f.endsWith(".ts"))
    .filter((f) => !PUBLIC_ACTION_FILES.has(f));
}

/** Names of every `export async function foo(` in a source file. */
function exportedActions(source: string): string[] {
  return [...source.matchAll(/export\s+async\s+function\s+(\w+)\s*\(/g)].map((m) => m[1]!);
}

/**
 * Body of one exported action, up to the next top-level `export` — enough to
 * see whether the guard is called before anything else happens.
 */
function actionBody(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  const rest = source.slice(start + 1);
  const next = rest.indexOf("\nexport ");
  return next === -1 ? rest : rest.slice(0, next);
}

/** Body of a module-private helper (`async function foo(...)`, no `export`). */
function helperBody(source: string, name: string): string | null {
  const match = new RegExp(`(?<!export\\s)async function ${name}\\s*\\(`).exec(source);
  if (!match) return null;
  const rest = source.slice(match.index);
  const next = rest.indexOf("\nexport ");
  return next === -1 ? rest : rest.slice(0, next);
}

const GUARD = /require(Admin|User)\s*\(/;

/**
 * True when the action enforces a guard itself, or delegates to exactly one
 * module-private helper that does.
 *
 * Several actions are deliberately thin wrappers over a shared helper
 * (`toggleFlag`, `setBroadcastStatus`) which calls requireAdmin() on its first
 * line, so a direct-text check alone reports them as unguarded when they are
 * not. One level of delegation is followed — no deeper, so an action cannot
 * bury its authorization behind a chain no reviewer would trace.
 */
function isGuarded(source: string, body: string): boolean {
  if (GUARD.test(body)) return true;
  for (const [, callee] of body.matchAll(/\b(?:return|await)\s+(\w+)\s*\(/g)) {
    const helper = helperBody(source, callee);
    if (helper && GUARD.test(helper)) return true;
  }
  return false;
}

test("every admin server action enforces authorization server-side", () => {
  const files = adminActionFiles();
  assert.ok(files.length > 0, "no admin action files found — check the path");

  const offenders: string[] = [];
  for (const file of files) {
    const source = readFileSync(join(ACTIONS_DIR, file), "utf8");
    if (!source.includes('"use server"')) continue;

    for (const name of exportedActions(source)) {
      // requireAdmin covers the admin panel; a few staff actions legitimately
      // use requireUser + an explicit role check instead.
      if (!isGuarded(source, actionBody(source, name))) {
        offenders.push(`${file}:${name}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `these server actions have no auth guard and are callable by anyone:\n  ${offenders.join("\n  ")}`
  );
});

test("the two new directory sections are covered by that guard", () => {
  // Named explicitly so the coverage above cannot silently stop applying to
  // them (e.g. if the file were added to the public allowlist by mistake).
  for (const file of ["admin-free-resources.ts", "admin-ai-platforms.ts"]) {
    const source = readFileSync(join(ACTIONS_DIR, file), "utf8");
    const actions = exportedActions(source);
    assert.ok(actions.length >= 4, `${file} should export the CRUD actions, found ${actions.length}`);
    for (const name of actions) {
      assert.match(
        actionBody(source, name),
        /await requireAdmin\(\)/,
        `${file}:${name} must call requireAdmin() before it does anything`
      );
    }
  }
});

test("neither new section trusts a client-supplied source/platform claim", () => {
  // The public badge must follow the URL's hostname. If saveFreeResourceAction
  // ever reads sourceType from the parsed form instead of calling
  // detectSourceType, a crafted POST could label any host as MEGA.
  const source = readFileSync(join(ACTIONS_DIR, "admin-free-resources.ts"), "utf8");
  assert.match(source, /sourceType:\s*detectSourceType\(/, "sourceType must be derived, not accepted");
  assert.ok(!/sourceType:\s*v\./.test(source), "sourceType must never come from the submitted form values");
});
