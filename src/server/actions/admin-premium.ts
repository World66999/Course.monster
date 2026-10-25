"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth-helpers";
import { logAudit } from "@/lib/audit";
import { addPremiumPeriod, revokePremium } from "@/lib/premium";
import { notifyUser } from "@/lib/telegram/notify";
import { siteUrl } from "@/lib/telegram/config";
import type { ActionResult } from "@/server/actions/courses";

const idSchema = z.string().cuid();

const grantSchema = z.object({
  userId: idSchema,
  months: z.number().int().min(1).max(36),
  note: z.string().max(200).optional().default(""),
});

/**
 * Grant or extend Premium by hand (e.g. someone paid another way through a
 * support ticket). Stacks on the current expiry exactly like a paid renewal.
 * ADMIN only — an EDITOR cannot hand out paid time.
 */
export async function grantPremiumAction(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin({ adminOnly: true });
  const parsed = grantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick a number of months between 1 and 36." };
  const { userId, months, note } = parsed.data;
  const target = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!target) return { ok: false, error: "User not found" };

  const result = await db.$transaction((tx) =>
    addPremiumPeriod(tx, {
      userId,
      plan: months % 12 === 0 ? "YEARLY" : "MONTHLY",
      months,
      source: "ADMIN",
      grantedById: admin.id,
      note: note || undefined,
    })
  );
  await logAudit({
    userId: admin.id,
    action: "premium.grant",
    entity: "user",
    entityId: userId,
    meta: { months, until: result.expiresAt.toISOString() },
  });
  await notifyUser(
    userId,
    `👑 <b>Premium added to your account</b>\n\nYou now have Premium until <b>${result.expiresAt.toISOString().slice(0, 10)}</b>. ` +
      `<a href="${siteUrl()}/premium">Open Premium</a>`
  );
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function revokePremiumAction(userId: unknown): Promise<ActionResult> {
  const admin = await requireAdmin({ adminOnly: true });
  const parsed = idSchema.safeParse(userId);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const target = await db.user.findUnique({ where: { id: parsed.data }, select: { id: true } });
  if (!target) return { ok: false, error: "User not found" };
  await db.$transaction((tx) => revokePremium(tx, parsed.data));
  await logAudit({ userId: admin.id, action: "premium.revoke", entity: "user", entityId: parsed.data });
  revalidatePath("/", "layout");
  return { ok: true };
}

const courseGrantSchema = z.object({ userId: idSchema, courseId: idSchema });

export async function grantCourseAction(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = courseGrantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const [user, course] = await Promise.all([
    db.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true } }),
    db.course.findUnique({ where: { id: parsed.data.courseId }, select: { id: true, title: true } }),
  ]);
  if (!user || !course) return { ok: false, error: "User or course not found" };
  await db.courseGrant.upsert({
    where: { userId_courseId: parsed.data },
    create: { ...parsed.data, grantedById: admin.id },
    update: {},
  });
  await logAudit({
    userId: admin.id,
    action: "course.grant",
    entity: "user",
    entityId: parsed.data.userId,
    meta: { courseId: course.id, title: course.title },
  });
  return { ok: true };
}

export async function revokeCourseGrantAction(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = courseGrantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  await db.courseGrant.deleteMany({ where: parsed.data });
  await logAudit({
    userId: admin.id,
    action: "course.grant_revoke",
    entity: "user",
    entityId: parsed.data.userId,
    meta: { courseId: parsed.data.courseId },
  });
  return { ok: true };
}
