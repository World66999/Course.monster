"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth-helpers";
import { logAudit } from "@/lib/audit";
import { recomputeCourseRating } from "@/lib/comments";
import type { ActionResult } from "@/server/actions/courses";

const idSchema = z.string().cuid();
const kindSchema = z.enum(["comment", "review"]);
const statusSchema = z.enum(["VISIBLE", "HIDDEN", "DELETED"]);

const ACTION_VERB: Record<z.infer<typeof statusSchema>, string> = {
  VISIBLE: "restore",
  HIDDEN: "hide",
  DELETED: "delete",
};

/**
 * Admin moderation for comments/reviews — all soft/reversible ("delete" here
 * still means ModerationStatus.DELETED, never a hard row delete).
 */
export async function moderateContentAction(
  kind: unknown,
  id: unknown,
  status: unknown
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsedKind = kindSchema.safeParse(kind);
  const parsedId = idSchema.safeParse(id);
  const parsedStatus = statusSchema.safeParse(status);
  if (!parsedKind.success || !parsedId.success || !parsedStatus.success) {
    return { ok: false, error: "Invalid request" };
  }

  try {
    if (parsedKind.data === "comment") {
      await db.comment.update({ where: { id: parsedId.data }, data: { status: parsedStatus.data } });
    } else {
      const existing = await db.review.findUniqueOrThrow({
        where: { id: parsedId.data },
        select: { courseId: true },
      });
      await db.$transaction(async (tx) => {
        await tx.review.update({ where: { id: parsedId.data }, data: { status: parsedStatus.data } });
        await recomputeCourseRating(tx, existing.courseId);
      });
    }
  } catch (err) {
    console.error("[moderation] status update failed:", err);
    return { ok: false, error: "Not found" };
  }

  await logAudit({
    userId: admin.id,
    action: `${parsedKind.data}.${ACTION_VERB[parsedStatus.data]}`,
    entity: parsedKind.data,
    entityId: parsedId.data,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function resolveReportAction(id: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid report" };

  const report = await db.report
    .update({ where: { id: parsed.data }, data: { status: "RESOLVED", resolvedAt: new Date() } })
    .catch(() => null);
  if (!report) return { ok: false, error: "Report not found" };

  await logAudit({ userId: admin.id, action: "report.resolve", entity: "report", entityId: parsed.data });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function dismissReportAction(id: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid report" };

  const report = await db.report
    .update({ where: { id: parsed.data }, data: { status: "DISMISSED", resolvedAt: new Date() } })
    .catch(() => null);
  if (!report) return { ok: false, error: "Report not found" };

  await logAudit({ userId: admin.id, action: "report.dismiss", entity: "report", entityId: parsed.data });
  revalidatePath("/", "layout");
  return { ok: true };
}
