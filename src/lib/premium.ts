import "server-only";
import type { Prisma, PremiumPlan } from "@prisma/client";
import { db } from "@/lib/db";
import { PLANS } from "@/lib/premium-plans";
import { isActiveUntil, periodEnd, periodStart } from "@/lib/premium-period";

export { hasExpired, isActiveUntil, periodEnd, periodStart } from "@/lib/premium-period";

/**
 * Premium status and the one place Premium time is added or removed.
 *
 * "Is this user Premium" is always answered from the database row, at request
 * time: `premiumUntil > now`. It is never cached in the JWT, so an expiry, a
 * refund or an admin revoke takes effect on the very next request, whether or
 * not the scheduled expiry job has run yet.
 */

type Tx = Prisma.TransactionClient;

export interface PremiumStatus {
  active: boolean;
  premiumUntil: Date | null;
  plan: PremiumPlan | null;
}

export async function getPremiumStatus(userId: string): Promise<PremiumStatus> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      premiumUntil: true,
      disabled: true,
      subscriptions: {
        where: { status: "ACTIVE" },
        orderBy: { expiresAt: "desc" },
        take: 1,
        select: { plan: true },
      },
    },
  });
  if (!user || user.disabled) return { active: false, premiumUntil: null, plan: null };
  const active = isActiveUntil(user.premiumUntil);
  return {
    active,
    premiumUntil: user.premiumUntil,
    plan: active ? (user.subscriptions[0]?.plan ?? null) : null,
  };
}

export async function isPremium(userId: string): Promise<boolean> {
  return (await getPremiumStatus(userId)).active;
}

/**
 * Adds one period of Premium on top of whatever the user already has, inside
 * the caller's transaction. Locks the user row first, so two activations for
 * the same user (two different payments finishing together) serialize and
 * chain instead of both starting from the same old expiry.
 */
export async function addPremiumPeriod(
  tx: Tx,
  args: {
    userId: string;
    plan: PremiumPlan;
    months?: number;
    source: "PAYMENT" | "ADMIN";
    paymentId?: string;
    grantedById?: string;
    note?: string;
    now?: Date;
  }
): Promise<{ startAt: Date; expiresAt: Date }> {
  const now = args.now ?? new Date();
  const months = args.months ?? PLANS[args.plan].months;
  const rows = await tx.$queryRaw<{ premiumUntil: Date | null }[]>`
    SELECT "premiumUntil" FROM "users" WHERE "id" = ${args.userId} FOR UPDATE`;
  if (rows.length === 0) throw new Error("user not found");
  const startAt = periodStart(rows[0]!.premiumUntil, now);
  const expiresAt = periodEnd(startAt, months);

  await tx.subscription.create({
    data: {
      userId: args.userId,
      plan: args.plan,
      startAt,
      expiresAt,
      status: "ACTIVE",
      source: args.source,
      paymentId: args.paymentId ?? null,
      grantedById: args.grantedById ?? null,
      note: args.note ?? null,
    },
  });
  await tx.user.update({ where: { id: args.userId }, data: { premiumUntil: expiresAt } });
  return { startAt, expiresAt };
}

/**
 * Rebuilds premiumUntil from the user's remaining ACTIVE periods after one is
 * taken away (refund or revoke). Periods are re-chained in their original
 * order, each keeping its own length, so removing one in the middle pulls the
 * later ones forward instead of leaving a gap the user already paid to close.
 */
export async function rechainPremium(tx: Tx, userId: string, now = new Date()): Promise<Date | null> {
  await tx.$queryRaw`SELECT 1 FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
  const periods = await tx.subscription.findMany({
    where: { userId, status: { in: ["ACTIVE", "EXPIRED"] } },
    orderBy: [{ startAt: "asc" }, { createdAt: "asc" }],
  });

  let cursor: Date | null = null;
  for (const p of periods) {
    const length = p.expiresAt.getTime() - p.startAt.getTime();
    // A period starts where the previous one ended, or at its own start if
    // there was a real gap (the user had lapsed before buying it).
    const start: Date = cursor && cursor.getTime() > p.startAt.getTime() ? cursor : p.startAt;
    const end = new Date(start.getTime() + length);
    if (start.getTime() !== p.startAt.getTime() || end.getTime() !== p.expiresAt.getTime()) {
      await tx.subscription.update({
        where: { id: p.id },
        data: {
          startAt: start,
          expiresAt: end,
          // Pulling a period forward can push it into the past.
          status: end.getTime() <= now.getTime() ? "EXPIRED" : "ACTIVE",
        },
      });
    }
    cursor = end;
  }

  const premiumUntil = cursor && cursor.getTime() > now.getTime() ? cursor : null;
  await tx.user.update({ where: { id: userId }, data: { premiumUntil } });
  return premiumUntil;
}

/** Ends every current period immediately (admin revoke). */
export async function revokePremium(tx: Tx, userId: string, now = new Date()): Promise<void> {
  await tx.$queryRaw`SELECT 1 FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
  await tx.subscription.updateMany({
    where: { userId, status: "ACTIVE" },
    data: { status: "REVOKED" },
  });
  await tx.user.update({ where: { id: userId }, data: { premiumUntil: now } });
}

/**
 * Whether this user may download a premium course: an active subscription, a
 * per-user grant from the admin panel, or staff.
 */
export async function canAccessPremiumCourse(userId: string, courseId: string): Promise<boolean> {
  const [user, grant] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { premiumUntil: true, disabled: true, role: true } }),
    db.courseGrant.findUnique({ where: { userId_courseId: { userId, courseId } }, select: { id: true } }),
  ]);
  if (!user || user.disabled) return false;
  if (user.role === "ADMIN" || user.role === "EDITOR") return true;
  return Boolean(grant) || isActiveUntil(user.premiumUntil);
}

/**
 * Whether a user's downloads skip the ad steps right now: active Premium, or
 * staff. Read from the database, so it flips the moment premiumUntil passes.
 */
export async function hasPremiumAccess(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { premiumUntil: true, disabled: true, role: true } });
  if (!user || user.disabled) return false;
  return user.role === "ADMIN" || user.role === "EDITOR" || isActiveUntil(user.premiumUntil);
}

/**
 * The one rule for a no-ads direct download: a premium course needs Premium,
 * staff or that course's grant; any other course needs Premium or staff.
 */
export function canDownloadDirect(userId: string, course: { id: string; premium: boolean }): Promise<boolean> {
  return course.premium ? canAccessPremiumCourse(userId, course.id) : hasPremiumAccess(userId);
}
