import "server-only";
import { addMonths } from "date-fns";
import type { Prisma, PremiumPlan } from "@prisma/client";
import { db } from "@/lib/db";
import { PLANS } from "@/lib/premium-plans";

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

export function isActiveUntil(premiumUntil: Date | null | undefined, now = new Date()): boolean {
  return Boolean(premiumUntil && premiumUntil.getTime() > now.getTime());
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
 * Where a new period starts: at the current expiry when the user is still
 * active (so renewing early never loses paid time), otherwise now.
 */
export function periodStart(currentUntil: Date | null, now = new Date()): Date {
  return isActiveUntil(currentUntil, now) ? (currentUntil as Date) : now;
}

export function periodEnd(start: Date, months: number): Date {
  return addMonths(start, months);
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
