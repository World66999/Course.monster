"use server";

import { revalidatePath } from "next/cache";
import { z } from "@/lib/zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth-helpers";
import { logAudit } from "@/lib/audit";
import { deleteUpload } from "@/lib/uploads";
import { notifyFollowers } from "@/lib/notifications";
import { REQUEST_STATUS_LABELS } from "@/lib/request-shared";
import { requestCommentSelect } from "@/lib/course-requests";
import { requestStatusEnum } from "@/lib/validation";
import type { RequestStatus } from "@/lib/request-shared";
import type { ActionResult } from "@/server/actions/courses";

const idSchema = z.string().cuid();
const moderationStatusSchema = z.enum(["VISIBLE", "HIDDEN", "DELETED"]);

const MODERATION_VERB: Record<z.infer<typeof moderationStatusSchema>, string> = {
  VISIBLE: "restore",
  HIDDEN: "hide",
  DELETED: "delete",
};

export async function moderateCourseRequestAction(id: unknown, status: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsedId = idSchema.safeParse(id);
  const parsedStatus = moderationStatusSchema.safeParse(status);
  if (!parsedId.success || !parsedStatus.success) return { ok: false, error: "Invalid request" };

  const updated = await db.courseRequest
    .update({ where: { id: parsedId.data }, data: { moderationStatus: parsedStatus.data } })
    .catch(() => null);
  if (!updated) return { ok: false, error: "Request not found" };

  await logAudit({
    userId: admin.id,
    action: `courseRequest.${MODERATION_VERB[parsedStatus.data]}`,
    entity: "courseRequest",
    entityId: parsedId.data,
  });
  revalidatePath("/requests");
  return { ok: true };
}

export async function changeRequestStatusAction(id: unknown, status: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsedId = idSchema.safeParse(id);
  const parsedStatus = requestStatusEnum.safeParse(status);
  if (!parsedId.success || !parsedStatus.success) return { ok: false, error: "Invalid request" };

  const existing = await db.courseRequest.findUnique({
    where: { id: parsedId.data },
    select: { userId: true, title: true, status: true },
  });
  if (!existing) return { ok: false, error: "Request not found" };
  if (existing.status === parsedStatus.data) return { ok: true };

  await db.courseRequest.update({ where: { id: parsedId.data }, data: { status: parsedStatus.data } });
  await logAudit({
    userId: admin.id,
    action: "courseRequest.status_change",
    entity: "courseRequest",
    entityId: parsedId.data,
    meta: { from: existing.status, to: parsedStatus.data },
  });
  await notifyFollowers({
    requestId: parsedId.data,
    actorId: admin.id,
    type: "REQUEST_STATUS_CHANGE",
    message: `"${existing.title}" is now ${REQUEST_STATUS_LABELS[parsedStatus.data as RequestStatus]}`,
  });
  revalidatePath("/requests");
  return { ok: true };
}

type ToggleField = "pinned" | "featured" | "commentsLocked";

async function toggleFlag(id: string, field: ToggleField, action: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const existing = await db.courseRequest.findUnique({
    where: { id },
    select: { pinned: true, featured: true, commentsLocked: true },
  });
  if (!existing) return { ok: false, error: "Request not found" };
  const next = !existing[field];

  switch (field) {
    case "pinned":
      await db.courseRequest.update({ where: { id }, data: { pinned: next } });
      break;
    case "featured":
      await db.courseRequest.update({ where: { id }, data: { featured: next } });
      break;
    case "commentsLocked":
      await db.courseRequest.update({ where: { id }, data: { commentsLocked: next } });
      break;
  }

  await logAudit({ userId: admin.id, action, entity: "courseRequest", entityId: id, meta: { [field]: next } });
  revalidatePath("/requests");
  return { ok: true };
}

export async function togglePinRequestAction(id: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  return toggleFlag(parsed.data, "pinned", "courseRequest.toggle_pin");
}

export async function toggleFeatureRequestAction(id: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  return toggleFlag(parsed.data, "featured", "courseRequest.toggle_feature");
}

export async function toggleCommentsLockAction(id: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  return toggleFlag(parsed.data, "commentsLocked", "courseRequest.toggle_comments_lock");
}

export async function removeRequestImageAction(id: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const existing = await db.courseRequest.findUnique({
    where: { id: parsed.data },
    select: { imageUrl: true, imageThumbUrl: true },
  });
  if (!existing) return { ok: false, error: "Request not found" };

  await db.courseRequest.update({ where: { id: parsed.data }, data: { imageUrl: null, imageThumbUrl: null } });
  if (existing.imageUrl) await deleteUpload(existing.imageUrl);
  if (existing.imageThumbUrl && existing.imageThumbUrl !== existing.imageUrl) {
    await deleteUpload(existing.imageThumbUrl);
  }

  await logAudit({ userId: admin.id, action: "courseRequest.remove_image", entity: "courseRequest", entityId: parsed.data });
  revalidatePath("/requests");
  return { ok: true };
}

/** Duplicate stays in place (never deleted) — just banners as merged and links to the canonical request. */
export async function mergeRequestAction(duplicateId: unknown, intoId: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsedDup = idSchema.safeParse(duplicateId);
  const parsedInto = idSchema.safeParse(intoId);
  if (!parsedDup.success || !parsedInto.success) return { ok: false, error: "Invalid request" };
  if (parsedDup.data === parsedInto.data) return { ok: false, error: "Can't merge a request into itself." };

  const target = await db.courseRequest.findUnique({ where: { id: parsedInto.data }, select: { id: true } });
  if (!target) return { ok: false, error: "Target request not found" };

  await db.courseRequest.update({ where: { id: parsedDup.data }, data: { mergedIntoId: parsedInto.data } });
  await logAudit({
    userId: admin.id,
    action: "courseRequest.merge",
    entity: "courseRequest",
    entityId: parsedDup.data,
    meta: { mergedInto: parsedInto.data },
  });
  revalidatePath("/requests");
  return { ok: true };
}

export async function adminRespondToRequestAction(requestId: unknown, body: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsedId = idSchema.safeParse(requestId);
  const parsedBody = z.string().trim().min(1).max(10_000).safeParse(body);
  if (!parsedId.success || !parsedBody.success) return { ok: false, error: "Invalid request" };

  const request = await db.courseRequest.findUnique({
    where: { id: parsedId.data },
    select: { userId: true, title: true, moderationStatus: true },
  });
  if (!request || request.moderationStatus === "DELETED") return { ok: false, error: "Request not found" };

  const [comment] = await db.$transaction([
    db.requestComment.create({
      data: { requestId: parsedId.data, userId: admin.id, body: parsedBody.data },
      select: requestCommentSelect,
    }),
    db.courseRequest.update({
      where: { id: parsedId.data },
      data: { commentCount: { increment: 1 }, lastActivityAt: new Date() },
    }),
  ]);

  await notifyFollowers({
    requestId: parsedId.data,
    actorId: admin.id,
    type: "ADMIN_RESPONSE",
    commentId: comment.id,
    message: `An admin responded to "${request.title}"`,
  });
  await logAudit({ userId: admin.id, action: "courseRequest.admin_response", entity: "courseRequest", entityId: parsedId.data });
  revalidatePath("/requests");
  return { ok: true, id: comment.id };
}

async function setRequestBanned(adminId: string, userId: string, banned: boolean): Promise<ActionResult> {
  const target = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target) return { ok: false, error: "User not found" };
  if (target.role === "ADMIN" || target.role === "EDITOR") {
    return { ok: false, error: "Staff accounts can't be banned from Course Requests." };
  }

  await db.user.update({ where: { id: userId }, data: { requestBanned: banned } });
  await logAudit({
    userId: adminId,
    action: banned ? "courseRequest.user.ban" : "courseRequest.user.unban",
    entity: "user",
    entityId: userId,
  });
  revalidatePath("/requests");
  return { ok: true };
}

export async function banUserFromRequestsAction(userId: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = idSchema.safeParse(userId);
  if (!parsed.success) return { ok: false, error: "Invalid user" };
  return setRequestBanned(admin.id, parsed.data, true);
}

export async function unbanUserFromRequestsAction(userId: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = idSchema.safeParse(userId);
  if (!parsed.success) return { ok: false, error: "Invalid user" };
  return setRequestBanned(admin.id, parsed.data, false);
}
