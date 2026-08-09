"use server";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUserSafe } from "@/server/auth-helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportFormSchema } from "@/lib/validation";
import type { ActionResult } from "@/server/actions/courses";

export async function reportContentAction(input: unknown): Promise<ActionResult> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;
  const parsed = reportFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const {
    commentId,
    reviewId,
    chatMessageId,
    courseRequestId,
    requestCommentId,
    codingChannelId,
    learningResourceId,
    appListingId,
    reason,
    note,
  } = parsed.data;

  const targetCount = [
    commentId,
    reviewId,
    chatMessageId,
    courseRequestId,
    requestCommentId,
    codingChannelId,
    learningResourceId,
    appListingId,
  ].filter(Boolean).length;
  if (targetCount === 0) return { ok: false, error: "Nothing to report." };
  if (targetCount > 1) return { ok: false, error: "Invalid report target." };

  // Reports are cheap to spam, so this gets its own tight limit.
  const rl = checkRateLimit(`report:${user.id}`, { limit: 20, windowMs: 60 * 60_000 });
  if (!rl.ok) return { ok: false, error: "Too many reports. Please try again later." };

  if (commentId) {
    const target = await db.comment.findUnique({ where: { id: commentId }, select: { userId: true } });
    if (!target) return { ok: false, error: "Comment not found." };
    if (target.userId === user.id) return { ok: false, error: "You can't report your own comment." };
  } else if (reviewId) {
    const target = await db.review.findUnique({ where: { id: reviewId }, select: { userId: true } });
    if (!target) return { ok: false, error: "Review not found." };
    if (target.userId === user.id) return { ok: false, error: "You can't report your own review." };
  } else if (chatMessageId) {
    const target = await db.chatMessage.findUnique({ where: { id: chatMessageId }, select: { userId: true } });
    if (!target) return { ok: false, error: "Message not found." };
    if (target.userId === user.id) return { ok: false, error: "You can't report your own message." };
  } else if (courseRequestId) {
    const target = await db.courseRequest.findUnique({ where: { id: courseRequestId }, select: { userId: true } });
    if (!target) return { ok: false, error: "Request not found." };
    if (target.userId === user.id) return { ok: false, error: "You can't report your own request." };
  } else if (requestCommentId) {
    const target = await db.requestComment.findUnique({ where: { id: requestCommentId }, select: { userId: true } });
    if (!target) return { ok: false, error: "Comment not found." };
    if (target.userId === user.id) return { ok: false, error: "You can't report your own comment." };
  } else if (codingChannelId) {
    const target = await db.codingChannel.findUnique({ where: { id: codingChannelId }, select: { id: true } });
    if (!target) return { ok: false, error: "Channel not found." };
  } else if (learningResourceId) {
    const target = await db.learningResource.findUnique({ where: { id: learningResourceId }, select: { id: true } });
    if (!target) return { ok: false, error: "Resource not found." };
  } else if (appListingId) {
    const target = await db.appListing.findUnique({ where: { id: appListingId }, select: { id: true } });
    if (!target) return { ok: false, error: "App not found." };
  }

  try {
    const report = await db.report.create({
      data: {
        commentId: commentId ?? null,
        reviewId: reviewId ?? null,
        chatMessageId: chatMessageId ?? null,
        courseRequestId: courseRequestId ?? null,
        requestCommentId: requestCommentId ?? null,
        codingChannelId: codingChannelId ?? null,
        learningResourceId: learningResourceId ?? null,
        appListingId: appListingId ?? null,
        reporterId: user.id,
        reason,
        note: note || null,
      },
    });
    return { ok: true, id: report.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "You've already reported this." };
    }
    console.error("[reports] create failed:", err);
    return { ok: false, error: "Failed to submit report." };
  }
}
