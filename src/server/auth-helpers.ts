import "server-only";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isStaff } from "@/lib/roles";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
  }
}

/**
 * Sessions are stateless JWTs (see auth.config.ts) with a 12h maxAge, so a
 * `disabled` flag set by an admin doesn't invalidate an already-issued
 * token on its own — it's only checked at sign-in time (src/auth.ts). This
 * indexed by-id lookup re-checks it on every guarded server action/admin
 * load, so a disabled account is cut off from mutating anything within one
 * request of being disabled, not up to 12h later.
 */
async function isDisabled(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { disabled: true } });
  return user?.disabled ?? true; // treat a vanished user as disabled, not trusted
}

/**
 * Server-side guard for every admin action and admin data loader.
 * Middleware already protects the admin routes; this is defense in depth so
 * server actions can never be invoked without a valid *staff* session. Public
 * commenters (role "USER") authenticate through the same Auth.js instance,
 * so the role check here (not just "is there a session") is load-bearing.
 */
export async function requireAdmin(opts: { adminOnly?: boolean } = {}) {
  const session = await auth();
  if (!session?.user?.id || !isStaff(session.user.role)) throw new UnauthorizedError();
  // Money and access (granting Premium, payments, revenue) are ADMIN-only:
  // an EDITOR curates content but must not be able to hand out paid time.
  // Read from the database, not the JWT, so a demotion takes effect at once.
  const row = await db.user.findUnique({
    where: { id: session.user.id },
    select: { disabled: true, role: true },
  });
  if (!row || row.disabled || !isStaff(row.role)) throw new UnauthorizedError();
  if (opts.adminOnly && row.role !== "ADMIN") throw new UnauthorizedError();
  return { ...session.user, role: row.role };
}

/**
 * Guard for comment/review actions: any authenticated session (admin, editor
 * or public "USER") may participate — an admin's existing session is a
 * legitimate verified identity too. Anonymous requests are always rejected.
 */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError();
  if (await isDisabled(session.user.id)) throw new UnauthorizedError();
  return session.user;
}

/**
 * Same guard as requireUser(), but returns a result instead of throwing.
 * Public-facing actions (comments/reviews/profile/reports) use this so a
 * rare-but-real edge case — an admin disables the account, or the session
 * otherwise stops being valid, while the user already has a form open —
 * fails with a normal toast message instead of an uncaught promise
 * rejection that silently leaves the form as if nothing happened.
 */
export async function requireUserSafe(): Promise<
  { ok: true; user: Awaited<ReturnType<typeof requireUser>> } | { ok: false; error: string }
> {
  try {
    return { ok: true, user: await requireUser() };
  } catch {
    return { ok: false, error: "Your session has expired or your account is unavailable. Please sign in again." };
  }
}
