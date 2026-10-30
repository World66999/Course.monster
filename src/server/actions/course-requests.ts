"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { requireUserSafe } from "@/server/auth-helpers";
import { getClientIp, hashIp } from "@/lib/ip";
import { checkContent } from "@/lib/profanity";
import { checkPostingRate, normalizeText } from "@/lib/spam-guards";
import { courseRequestFormSchema } from "@/lib/validation";
import { getSiteSettings } from "@/lib/settings";
import { logAudit } from "@/lib/audit";
import { slugify } from "@/lib/utils";
import { parseTagsInput } from "@/lib/request-shared";
import { assertCanPostRequest, courseRequestSelect, type CourseRequestRow } from "@/lib/course-requests";
import { deleteUpload } from "@/lib/uploads";
import type { ActionResult } from "@/server/actions/courses";

const idSchema = z.string().cuid();

async function uniqueRequestSlug(title: string): Promise<string> {
  const base = slugify(title) || "course-request";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomBytes(3).toString("hex")}`;
    const exists = await db.courseRequest.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  return `${base}-${randomBytes(6).toString("hex")}`;
}

/**
 * Returns the full created/updated row (same shape every list query already
 * uses, via courseRequestSelect) so the client can reconcile its optimistic
 * UI with server truth, same convention as createCommentAction.
 */
export async function createCourseRequestAction(
  input: unknown
): Promise<ActionResult & { request?: CourseRequestRow }> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;

  const guard = await assertCanPostRequest(user.id);
  if (!guard.ok) return guard;

  const parsed = courseRequestFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const settings = await getSiteSettings();
  if (!settings.courseRequests.enabled) return { ok: false, error: "Course Requests is currently disabled." };
  if (data.description.length < settings.courseRequests.descriptionMinLength) {
    return {
      ok: false,
      error: `Description must be at least ${settings.courseRequests.descriptionMinLength} characters.`,
    };
  }
  if (data.description.length > settings.courseRequests.descriptionMaxLength) {
    return {
      ok: false,
      error: `Description must be under ${settings.courseRequests.descriptionMaxLength} characters.`,
    };
  }

  const rate = checkPostingRate(user.id, "courseRequest", settings.courseRequests);
  if (!rate.ok) return rate;

  if (data.categoryId) {
    const category = await db.category.findUnique({ where: { id: data.categoryId }, select: { id: true } });
    if (!category) return { ok: false, error: "Category not found." };
  }

  // Duplicate-identical-request prevention within the configured window.
  const dupWindowStart = new Date(Date.now() - settings.courseRequests.duplicateWindowMinutes * 60_000);
  const recent = await db.courseRequest.findFirst({
    where: { userId: user.id, createdAt: { gt: dupWindowStart } },
    orderBy: { createdAt: "desc" },
    select: { title: true },
  });
  if (recent && normalizeText(recent.title) === normalizeText(data.title)) {
    return { ok: false, error: "You've already submitted this request." };
  }

  const ip = await getClientIp();
  const ipHash = hashIp(ip);
  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;

  const check = settings.courseRequests.profanityFilterEnabled
    ? checkContent(`${data.title} ${data.description} ${data.motivation}`)
    : { flagged: false, reasons: [] as string[] };

  const slug = await uniqueRequestSlug(data.title);

  const request = await db.courseRequest.create({
    data: {
      userId: user.id,
      kind: data.kind,
      title: data.title,
      slug,
      categoryId: data.categoryId || null,
      subject: data.subject,
      description: data.description,
      motivation: data.motivation,
      skillLevel: data.skillLevel || null,
      instructor: data.instructor || null,
      sourceProvider: data.sourceProvider || null,
      referenceUrl: data.referenceUrl || null,
      tags: parseTagsInput(data.tags),
      imageUrl: data.imageUrl ?? null,
      imageThumbUrl: data.imageThumbUrl ?? data.imageUrl ?? null,
      anonymous: data.anonymous,
      moderationStatus: check.flagged ? "HIDDEN" : "VISIBLE",
      ipHash,
      userAgent,
    },
    select: courseRequestSelect,
  });

  if (check.flagged) {
    await logAudit({
      userId: user.id,
      action: "courseRequest.autoflag",
      entity: "courseRequest",
      entityId: request.id,
      meta: { reasons: check.reasons },
    });
  } else {
    // Auto-follow your own request — "I want updates on this" is implicit
    // in creating it. Lets the notification fan-out treat "notify the
    // owner" and "notify followers" as the same code path.
    await db.requestFollow.create({ data: { requestId: request.id, userId: user.id } }).catch(() => undefined);
  }

  return { ok: true, id: request.id, request };
}

export async function editCourseRequestAction(
  requestId: unknown,
  input: unknown
): Promise<ActionResult & { request?: CourseRequestRow }> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;

  const parsedId = idSchema.safeParse(requestId);
  if (!parsedId.success) return { ok: false, error: "Invalid request" };

  const guard = await assertCanPostRequest(user.id);
  if (!guard.ok) return guard;

  const existing = await db.courseRequest.findUnique({ where: { id: parsedId.data } });
  if (!existing || existing.moderationStatus === "DELETED") return { ok: false, error: "Request not found." };
  if (existing.userId !== user.id) return { ok: false, error: "You can only edit your own request." };

  const parsed = courseRequestFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const settings = await getSiteSettings();
  if (data.description.length < settings.courseRequests.descriptionMinLength) {
    return {
      ok: false,
      error: `Description must be at least ${settings.courseRequests.descriptionMinLength} characters.`,
    };
  }
  if (data.categoryId) {
    const category = await db.category.findUnique({ where: { id: data.categoryId }, select: { id: true } });
    if (!category) return { ok: false, error: "Category not found." };
  }

  const check = settings.courseRequests.profanityFilterEnabled
    ? checkContent(`${data.title} ${data.description} ${data.motivation}`)
    : { flagged: false, reasons: [] as string[] };

  // Replace the old image only if a new one was actually uploaded — an
  // untouched form resubmits the same imageUrl/imageThumbUrl it already had.
  const oldImage = existing.imageUrl;
  const newImage = data.imageUrl ?? null;
  if (oldImage && newImage !== oldImage) {
    await deleteUpload(oldImage);
    if (existing.imageThumbUrl && existing.imageThumbUrl !== existing.imageUrl) {
      await deleteUpload(existing.imageThumbUrl);
    }
  }

  const request = await db.courseRequest.update({
    where: { id: parsedId.data },
    data: {
      kind: data.kind,
      title: data.title,
      categoryId: data.categoryId || null,
      subject: data.subject,
      description: data.description,
      motivation: data.motivation,
      skillLevel: data.skillLevel || null,
      instructor: data.instructor || null,
      sourceProvider: data.sourceProvider || null,
      referenceUrl: data.referenceUrl || null,
      tags: parseTagsInput(data.tags),
      imageUrl: data.imageUrl ?? null,
      imageThumbUrl: data.imageThumbUrl ?? data.imageUrl ?? null,
      anonymous: data.anonymous,
      moderationStatus: check.flagged ? "HIDDEN" : existing.moderationStatus === "HIDDEN" ? "HIDDEN" : "VISIBLE",
    },
    select: courseRequestSelect,
  });

  return { ok: true, id: request.id, request };
}

export async function deleteCourseRequestAction(requestId: unknown): Promise<ActionResult> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;
  const parsed = idSchema.safeParse(requestId);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const existing = await db.courseRequest.findUnique({ where: { id: parsed.data }, select: { userId: true } });
  if (!existing) return { ok: false, error: "Request not found." };
  if (existing.userId !== user.id) return { ok: false, error: "You can only delete your own request." };

  await db.courseRequest.update({ where: { id: parsed.data }, data: { moderationStatus: "DELETED" } });
  return { ok: true };
}

export async function toggleRequestVoteAction(
  requestId: unknown
): Promise<ActionResult & { voted?: boolean; voteCount?: number }> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;
  const parsed = idSchema.safeParse(requestId);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const guard = await assertCanPostRequest(user.id);
  if (!guard.ok) return guard;

  const request = await db.courseRequest.findUnique({
    where: { id: parsed.data },
    select: { id: true, moderationStatus: true },
  });
  if (!request || request.moderationStatus !== "VISIBLE") return { ok: false, error: "Request not found." };

  const existing = await db.requestVote.findUnique({
    where: { requestId_userId: { requestId: parsed.data, userId: user.id } },
  });

  if (existing) {
    const [, updated] = await db.$transaction([
      db.requestVote.delete({ where: { id: existing.id } }),
      db.courseRequest.update({ where: { id: parsed.data }, data: { voteCount: { decrement: 1 } } }),
    ]);
    return { ok: true, voted: false, voteCount: updated.voteCount };
  }

  const [, updated] = await db.$transaction([
    db.requestVote.create({ data: { requestId: parsed.data, userId: user.id } }),
    db.courseRequest.update({
      where: { id: parsed.data },
      data: { voteCount: { increment: 1 }, lastActivityAt: new Date() },
    }),
  ]);
  return { ok: true, voted: true, voteCount: updated.voteCount };
}

export async function toggleRequestBookmarkAction(
  requestId: unknown
): Promise<ActionResult & { bookmarked?: boolean; bookmarkCount?: number }> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;
  const parsed = idSchema.safeParse(requestId);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const request = await db.courseRequest.findUnique({
    where: { id: parsed.data },
    select: { id: true, moderationStatus: true },
  });
  if (!request || request.moderationStatus !== "VISIBLE") return { ok: false, error: "Request not found." };

  const existing = await db.requestBookmark.findUnique({
    where: { requestId_userId: { requestId: parsed.data, userId: user.id } },
  });

  if (existing) {
    const [, updated] = await db.$transaction([
      db.requestBookmark.delete({ where: { id: existing.id } }),
      db.courseRequest.update({ where: { id: parsed.data }, data: { bookmarkCount: { decrement: 1 } } }),
    ]);
    return { ok: true, bookmarked: false, bookmarkCount: updated.bookmarkCount };
  }

  const [, updated] = await db.$transaction([
    db.requestBookmark.create({ data: { requestId: parsed.data, userId: user.id } }),
    db.courseRequest.update({ where: { id: parsed.data }, data: { bookmarkCount: { increment: 1 } } }),
  ]);
  return { ok: true, bookmarked: true, bookmarkCount: updated.bookmarkCount };
}

/**
 * Distinct from bookmarking: following opts into notifications for a
 * request's activity (new comments, status changes, admin responses) —
 * see notifyFollowers() in src/lib/notifications.ts. No denormalized
 * counter — follows aren't shown as a public metric, only used to decide
 * who to notify.
 */
export async function toggleRequestFollowAction(
  requestId: unknown
): Promise<ActionResult & { followed?: boolean }> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;
  const parsed = idSchema.safeParse(requestId);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const request = await db.courseRequest.findUnique({
    where: { id: parsed.data },
    select: { id: true, moderationStatus: true },
  });
  if (!request || request.moderationStatus !== "VISIBLE") return { ok: false, error: "Request not found." };

  const existing = await db.requestFollow.findUnique({
    where: { requestId_userId: { requestId: parsed.data, userId: user.id } },
  });

  if (existing) {
    await db.requestFollow.delete({ where: { id: existing.id } });
    return { ok: true, followed: false };
  }

  await db.requestFollow.create({ data: { requestId: parsed.data, userId: user.id } });
  return { ok: true, followed: true };
}
