"use server";

import { z } from "@/lib/zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUserSafe } from "@/server/auth-helpers";
import { checkRateLimit } from "@/lib/rate-limit";

/** One budget for creating, editing and deleting reviews, per account. */
function reviewWriteAllowed(userId: string): boolean {
  return checkRateLimit(`review-write:${userId}`, { limit: 20, windowMs: 10 * 60_000 }).ok;
}
const TOO_MANY_REVIEW_WRITES = "You're doing that too often. Please wait a few minutes.";
import { getClientIp, hashIp } from "@/lib/ip";
import { checkContent } from "@/lib/profanity";
import { checkPostingRate } from "@/lib/spam-guards";
import { reviewFormSchema } from "@/lib/validation";
import { getSiteSettings } from "@/lib/settings";
import { recomputeCourseRating, reviewSelect, getReviewSummary, type ReviewWithAuthor, type ReviewSummary } from "@/lib/comments";
import type { ActionResult } from "@/server/actions/courses";
import { revalidateCoursePage } from "@/server/revalidate-course";

const idSchema = z.string().cuid();

/**
 * Returns the full created/updated row plus the freshly recomputed course
 * summary (same shape getReviewSummary() already produces) so the client
 * can reconcile its optimistic average-rating/histogram with server truth
 * in one round trip, instead of guessing or re-fetching separately. As with
 * comments, a profanity/spam-flagged review comes back HIDDEN — every list
 * query already filters to VISIBLE only.
 */
export async function createReviewAction(
  input: unknown
): Promise<ActionResult & { review?: ReviewWithAuthor; summary?: ReviewSummary }> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;
  if (!reviewWriteAllowed(user.id)) return { ok: false, error: TOO_MANY_REVIEW_WRITES };
  const parsed = reviewFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { courseId, rating, title, body } = parsed.data;

  const settings = await getSiteSettings();
  if (!settings.comments.enabled) return { ok: false, error: "Reviews are currently disabled." };

  const trimmedBody = body.trim();
  if (trimmedBody.length < settings.comments.minLength) {
    return { ok: false, error: `Review must be at least ${settings.comments.minLength} characters.` };
  }
  if (trimmedBody.length > settings.comments.reviewMaxLength) {
    return { ok: false, error: `Review must be under ${settings.comments.reviewMaxLength} characters.` };
  }

  const rate = checkPostingRate(user.id, "review", settings.comments);
  if (!rate.ok) return rate;

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, published: true },
  });
  if (!course || !course.published) return { ok: false, error: "Course not found." };

  const ip = await getClientIp();
  const ipHash = hashIp(ip);
  const check = settings.comments.profanityFilterEnabled
    ? checkContent(`${title} ${trimmedBody}`)
    : { flagged: false, reasons: [] as string[] };

  try {
    const review = await db.$transaction(async (tx) => {
      const data = {
        rating,
        title: title || null,
        body: trimmedBody,
        status: check.flagged ? ("HIDDEN" as const) : ("VISIBLE" as const),
        ipHash,
      };
      // Deleting a review is a soft delete, and (courseId, userId) is unique,
      // so a plain create after a delete hit P2002 and told the user they had
      // "already reviewed" a course they could no longer see a review for —
      // locking them out of reviewing it ever again. A deleted review is
      // revived with the new content instead; a live one still conflicts.
      const prior = await tx.review.findUnique({
        where: { courseId_userId: { courseId, userId: user.id } },
        select: { id: true, status: true },
      });
      const saved =
        prior?.status === "DELETED"
          ? await tx.review.update({
              where: { id: prior.id },
              data: { ...data, createdAt: new Date() },
              select: reviewSelect,
            })
          : await tx.review.create({
              data: { ...data, courseId, userId: user.id },
              select: reviewSelect,
            });
      await recomputeCourseRating(tx, courseId);
      return saved;
    });
    const summary = await getReviewSummary(courseId);
    await revalidateCoursePage(courseId);
    return { ok: true, id: review.id, review, summary };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "You've already reviewed this course. You can edit your existing review." };
    }
    console.error("[reviews] create failed:", err);
    return { ok: false, error: "Failed to submit review." };
  }
}

export async function editReviewAction(
  reviewId: unknown,
  input: unknown
): Promise<ActionResult & { review?: ReviewWithAuthor; summary?: ReviewSummary }> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;
  if (!reviewWriteAllowed(user.id)) return { ok: false, error: TOO_MANY_REVIEW_WRITES };
  const parsedId = idSchema.safeParse(reviewId);
  if (!parsedId.success) return { ok: false, error: "Invalid review" };

  const settings = await getSiteSettings();
  const parsed = z
    .object({
      rating: z.coerce.number().int().min(1).max(5),
      title: z.string().trim().max(120).optional().default(""),
      body: z
        .string()
        .trim()
        .min(settings.comments.minLength)
        .max(settings.comments.reviewMaxLength),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const existing = await db.review.findUnique({ where: { id: parsedId.data } });
  if (!existing || existing.status === "DELETED") return { ok: false, error: "Review not found." };
  if (existing.userId !== user.id) return { ok: false, error: "You can only edit your own review." };

  const { rating, title, body } = parsed.data;
  const check = settings.comments.profanityFilterEnabled
    ? checkContent(`${title} ${body}`)
    : { flagged: false, reasons: [] as string[] };

  const review = await db.$transaction(async (tx) => {
    const updated = await tx.review.update({
      where: { id: parsedId.data },
      data: {
        rating,
        title: title || null,
        body,
        status: check.flagged ? "HIDDEN" : existing.status === "HIDDEN" ? "HIDDEN" : "VISIBLE",
      },
      select: reviewSelect,
    });
    await recomputeCourseRating(tx, existing.courseId);
    return updated;
  });
  const summary = await getReviewSummary(existing.courseId);
  await revalidateCoursePage(existing.courseId);

  return { ok: true, id: parsedId.data, review, summary };
}

export async function deleteReviewAction(
  reviewId: unknown
): Promise<ActionResult & { summary?: ReviewSummary }> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;
  if (!reviewWriteAllowed(user.id)) return { ok: false, error: TOO_MANY_REVIEW_WRITES };
  const parsed = idSchema.safeParse(reviewId);
  if (!parsed.success) return { ok: false, error: "Invalid review" };

  const existing = await db.review.findUnique({
    where: { id: parsed.data },
    select: { userId: true, courseId: true },
  });
  if (!existing) return { ok: false, error: "Review not found." };
  if (existing.userId !== user.id) return { ok: false, error: "You can only delete your own review." };

  await db.$transaction(async (tx) => {
    await tx.review.update({ where: { id: parsed.data }, data: { status: "DELETED" } });
    await recomputeCourseRating(tx, existing.courseId);
  });
  const summary = await getReviewSummary(existing.courseId);
  await revalidateCoursePage(existing.courseId);

  return { ok: true, summary };
}
