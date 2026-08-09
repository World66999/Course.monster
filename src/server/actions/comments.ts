"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireUserSafe } from "@/server/auth-helpers";
import { getClientIp, hashIp } from "@/lib/ip";
import { checkContent } from "@/lib/profanity";
import { checkPostingRate, normalizeText } from "@/lib/spam-guards";
import { commentFormSchema } from "@/lib/validation";
import { getSiteSettings } from "@/lib/settings";
import { logAudit } from "@/lib/audit";
import { commentSelect, type CommentWithAuthor } from "@/lib/comments";
import type { ActionResult } from "@/server/actions/courses";

const idSchema = z.string().cuid();

/**
 * Returns the full created/updated row (same shape every list query already
 * uses, via commentSelect) so the client can reconcile its optimistic UI
 * with server truth — in particular the auto-moderation status: a
 * profanity/spam-flagged comment comes back HIDDEN, and every list query
 * already filters to VISIBLE only, so the caller must not leave a phantom
 * "visible" optimistic entry in that case.
 */
export async function createCommentAction(
  input: unknown
): Promise<ActionResult & { comment?: CommentWithAuthor }> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;
  const parsed = commentFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { courseId, parentId, body } = parsed.data;

  const settings = await getSiteSettings();
  if (!settings.comments.enabled) return { ok: false, error: "Comments are currently disabled." };

  const trimmed = body.trim();
  if (trimmed.length < settings.comments.minLength) {
    return { ok: false, error: `Comment must be at least ${settings.comments.minLength} characters.` };
  }
  if (trimmed.length > settings.comments.maxLength) {
    return { ok: false, error: `Comment must be under ${settings.comments.maxLength} characters.` };
  }

  const rate = checkPostingRate(user.id, "comment", settings.comments);
  if (!rate.ok) return rate;

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, published: true },
  });
  if (!course || !course.published) return { ok: false, error: "Course not found." };

  if (parentId) {
    const parent = await db.comment.findUnique({
      where: { id: parentId },
      select: { courseId: true, parentId: true, status: true },
    });
    if (!parent || parent.courseId !== courseId || parent.status === "DELETED") {
      return { ok: false, error: "Comment not found." };
    }
    if (parent.parentId) return { ok: false, error: "Replies can't be nested further." };
  }

  // Duplicate-identical-comment prevention within the configured window.
  const dupWindowStart = new Date(Date.now() - settings.comments.duplicateWindowMinutes * 60_000);
  const recent = await db.comment.findFirst({
    where: { userId: user.id, courseId, createdAt: { gt: dupWindowStart } },
    orderBy: { createdAt: "desc" },
    select: { body: true },
  });
  if (recent && normalizeText(recent.body) === normalizeText(trimmed)) {
    return { ok: false, error: "You've already posted this." };
  }

  const ip = await getClientIp();
  const ipHash = hashIp(ip);
  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  const check = settings.comments.profanityFilterEnabled
    ? checkContent(trimmed)
    : { flagged: false, reasons: [] as string[] };

  const comment = await db.comment.create({
    data: {
      courseId,
      userId: user.id,
      parentId: parentId ?? null,
      body: trimmed,
      status: check.flagged ? "HIDDEN" : "VISIBLE",
      ipHash,
      userAgent,
    },
    select: commentSelect,
  });

  if (check.flagged) {
    await logAudit({
      userId: user.id,
      action: "comment.autoflag",
      entity: "comment",
      entityId: comment.id,
      meta: { reasons: check.reasons },
    });
  }

  return { ok: true, id: comment.id, comment };
}

export async function editCommentAction(
  commentId: unknown,
  body: unknown
): Promise<ActionResult & { comment?: CommentWithAuthor }> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;
  const parsedId = idSchema.safeParse(commentId);
  if (!parsedId.success) return { ok: false, error: "Invalid comment" };

  const settings = await getSiteSettings();
  const parsedBody = z
    .string()
    .trim()
    .min(settings.comments.minLength, `Comment must be at least ${settings.comments.minLength} characters.`)
    .max(settings.comments.maxLength, `Comment must be under ${settings.comments.maxLength} characters.`)
    .safeParse(body);
  if (!parsedBody.success) {
    return { ok: false, error: parsedBody.error.issues[0]?.message ?? "Invalid comment" };
  }

  const existing = await db.comment.findUnique({ where: { id: parsedId.data } });
  if (!existing || existing.status === "DELETED") return { ok: false, error: "Comment not found." };
  if (existing.userId !== user.id) return { ok: false, error: "You can only edit your own comments." };

  const trimmed = parsedBody.data;
  const check = settings.comments.profanityFilterEnabled
    ? checkContent(trimmed)
    : { flagged: false, reasons: [] as string[] };

  const comment = await db.comment.update({
    where: { id: parsedId.data },
    data: {
      body: trimmed,
      editedAt: new Date(),
      status: check.flagged ? "HIDDEN" : existing.status === "HIDDEN" ? "HIDDEN" : "VISIBLE",
    },
    select: commentSelect,
  });

  return { ok: true, id: parsedId.data, comment };
}

export async function deleteCommentAction(commentId: unknown): Promise<ActionResult> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;
  const parsed = idSchema.safeParse(commentId);
  if (!parsed.success) return { ok: false, error: "Invalid comment" };

  const existing = await db.comment.findUnique({ where: { id: parsed.data }, select: { userId: true } });
  if (!existing) return { ok: false, error: "Comment not found." };
  if (existing.userId !== user.id) return { ok: false, error: "You can only delete your own comments." };

  await db.comment.update({ where: { id: parsed.data }, data: { status: "DELETED" } });
  return { ok: true };
}

export async function toggleCommentLikeAction(
  commentId: unknown
): Promise<ActionResult & { liked?: boolean; likeCount?: number }> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;
  const parsed = idSchema.safeParse(commentId);
  if (!parsed.success) return { ok: false, error: "Invalid comment" };

  const comment = await db.comment.findUnique({
    where: { id: parsed.data },
    select: { id: true, status: true },
  });
  if (!comment || comment.status !== "VISIBLE") return { ok: false, error: "Comment not found." };

  const existing = await db.commentLike.findUnique({
    where: { commentId_userId: { commentId: parsed.data, userId: user.id } },
  });

  if (existing) {
    const [, updated] = await db.$transaction([
      db.commentLike.delete({ where: { id: existing.id } }),
      db.comment.update({ where: { id: parsed.data }, data: { likeCount: { decrement: 1 } } }),
    ]);
    return { ok: true, liked: false, likeCount: updated.likeCount };
  }

  const [, updated] = await db.$transaction([
    db.commentLike.create({ data: { commentId: parsed.data, userId: user.id } }),
    db.comment.update({ where: { id: parsed.data }, data: { likeCount: { increment: 1 } } }),
  ]);
  return { ok: true, liked: true, likeCount: updated.likeCount };
}
