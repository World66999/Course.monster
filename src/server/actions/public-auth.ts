"use server";

import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/ip";
import { loginFormSchema } from "@/lib/validation";
import type { ActionResult } from "@/server/actions/courses";

/**
 * Rate-limits and does friendly disabled/unverified checks BEFORE the client
 * attempts the real sign-in. The actual credential check happens client-side
 * via next-auth/react's `signIn()` (not here) — that's what lets the header/
 * avatar/session update instantly everywhere without a manual refresh;
 * calling Auth.js's server-side `signIn()` from a Server Action sets the
 * cookie correctly but never notifies the client's session context. See
 * `authorize()` in src/auth.ts, which remains the authoritative gate
 * regardless of this precheck.
 */
export async function precheckLoginAction(input: unknown): Promise<ActionResult> {
  const parsed = loginFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { identifier } = parsed.data;

  const ip = await getClientIp();
  const rl = checkRateLimit(`login-ip:${hashIp(ip)}`, { limit: 20, windowMs: 15 * 60_000 });
  if (!rl.ok) return { ok: false, error: "Too many login attempts. Please wait a few minutes." };

  const isEmail = identifier.includes("@");
  const existing = await db.user.findFirst({
    where: isEmail ? { email: identifier.toLowerCase() } : { username: identifier.toLowerCase() },
    select: { emailVerified: true, disabled: true, passwordHash: true },
  });
  if (existing?.disabled) {
    return { ok: false, error: "This account has been disabled. Contact support for help." };
  }
  if (existing?.passwordHash && !existing.emailVerified) {
    return { ok: false, error: "Please verify your email before signing in." };
  }

  return { ok: true };
}
