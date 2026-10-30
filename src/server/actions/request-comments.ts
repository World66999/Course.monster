"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireUserSafe } from "@/server/auth-helpers";
import { getClientIp, hashIp } from "@/lib/ip";
import { checkContent } from "@/lib/profanity";
import { checkPostingRate, normalizeText } from "@/lib/spam-guards";
import { requestCommentFormSchema, requestCommentReactionSchema } from "@/lib/validation";
import { getSiteSettings } from "@/lib/settings";
import { isValidChatEmoji } from "@/lib/chat-shared";
import {
  assertCanPostRequest,
  requestCommentSelect,
  attachRequestCommentReactions,
  extractMentionIds,
  toRequestCommentDTO,
} from "@/lib/course-requests";
import { createNotification, notifyFollowers } from "@/lib/notifications";
import type { RequestCommentDTO } from "@/lib/request-shared";
import type { ActionResult } from "@/server/actions/courses";

const idSchema = z.string().cuid();

async function notifyForNewComment(params: {
  requestId: string;
  commentId: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  body: string;
}) {
  const request = await db.courseRequest.findUnique({
    where: { id: params.requestId },
    select: { userId: true, title: true, slug: true },
  });
  if (!request) return;

  // The parent-comment author (for a reply) gets a specific, targeted
  // notification; everyone else following the request gets a general
  // activity one. excludeUserIds keeps them from getting both for the
  // same event.
  let excludeFromFollowerFanout: string[] = [];

  if (params.parentId) {
    const parent = await db.requestComment.findUnique({
      where: { id: params.parentId },
      select: { userId: true },
    });
    if (parent) {
      excludeFromFollowerFanout = [parent.userId];
      await createNotification({
        userId: parent.userId,
        actorId: params.authorId,
        type: "REQUEST_REPLY",
        requestId: params.requestId,
        commentId: params.commentId,
        message: `${params.authorName} replied to your comment on "${request.title}"`,
      });
    }
  }

  await notifyFollowers({
    requestId: params.requestId,
    actorId: params.authorId,
    excludeUserIds: excludeFromFollowerFanout,
    type: "REQUEST_COMMENT",
    commentId: params.commentId,
    message: `${params.authorName} ${params.parentId ? "replied" : "commented"} on "${request.title}"`,
  });

  const mentionIds = extractMentionIds(params.body).filter(
    (id) => id !== request.userId && id !== params.authorId
  );
  for (const userId of new Set(mentionIds)) {
    await createNotification({
      userId,
      actorId: params.authorId,
      type: "REQUEST_MENTION",
      requestId: params.requestId,
      commentId: params.commentId,
      message: `${params.authorName} mentioned you on "${request.title}"`,
    });
  }
}

export async function createRequestCommentAction(
  input: unknown
): Promise<ActionResult & { comment?: RequestCommentDTO }> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;

  const guard = await assertCanPostRequest(user.id);
  if (!guard.ok) return guard;

  const parsed = requestCommentFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { requestId, parentId, body } = parsed.data;

  const settings = await getSiteSettings();
  if (!settings.courseRequests.enabled) return { ok: false, error: "Course Requests is currently disabled." };
  const trimmed = body.trim();
  if (trimmed.length < settings.courseRequests.commentMinLength) {
    return { ok: false, error: `Comment must be at least ${settings.courseRequests.commentMinLength} characters.` };
  }
  if (trimmed.length > settings.courseRequests.commentMaxLength) {
    return { ok: false, error: `Comment must be under ${settings.courseRequests.commentMaxLength} characters.` };
  }

  const rate = checkPostingRate(user.id, "requestComment", settings.courseRequests);
  if (!rate.ok) return rate;

  const request = await db.courseRequest.findUnique({
    where: { id: requestId },
    select: { id: true, moderationStatus: true, commentsLocked: true },
  });
  if (!request || request.moderationStatus !== "VISIBLE") return { ok: false, error: "Request not found." };
  if (request.commentsLocked) return { ok: false, error: "Comments are locked on this request." };

  if (parentId) {
    const parent = await db.requestComment.findUnique({
      where: { id: parentId },
      select: { requestId: true, parentId: true, status: true },
    });
    if (!parent || parent.requestId !== requestId || parent.status === "DELETED") {
      return { ok: false, error: "Comment not found." };
    }
    if (parent.parentId) return { ok: false, error: "Replies can't be nested further." };
  }

  const dupWindowStart = new Date(Date.now() - settings.courseRequests.duplicateWindowMinutes * 60_000);
  const recent = await db.requestComment.findFirst({
    where: { userId: user.id, requestId, createdAt: { gt: dupWindowStart } },
    orderBy: { createdAt: "desc" },
    select: { body: true },
  });
  if (recent && normalizeText(recent.body) === normalizeText(trimmed)) {
    return { ok: false, error: "You've already posted this." };
  }

  const ip = await getClientIp();
  const ipHash = hashIp(ip);
  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  const check = settings.courseRequests.profanityFilterEnabled
    ? checkContent(trimmed)
    : { flagged: false, reasons: [] as string[] };

  const [comment] = await db.$transaction([
    db.requestComment.create({
      data: {
        requestId,
        userId: user.id,
        parentId: parentId ?? null,
        body: trimmed,
        status: check.flagged ? "HIDDEN" : "VISIBLE",
        ipHash,
        userAgent,
      },
      select: requestCommentSelect,
    }),
    db.courseRequest.update({
      where: { id: requestId },
      data: { commentCount: { increment: 1 }, lastActivityAt: new Date() },
    }),
  ]);

  if (!check.flagged) {
    await notifyForNewComment({
      requestId,
      commentId: comment.id,
      parentId: parentId ?? null,
      authorId: user.id,
      authorName: user.name ?? "Someone",
      body: trimmed,
    });
  }

  return { ok: true, id: comment.id, comment: toRequestCommentDTO({ ...comment, reactions: [] }, user.id) };
}

export async function editRequestCommentAction(
  commentId: unknown,
  body: unknown
): Promise<ActionResult & { comment?: RequestCommentDTO }> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;
  const parsedId = idSchema.safeParse(commentId);
  if (!parsedId.success) return { ok: false, error: "Invalid comment" };

  const settings = await getSiteSettings();
  const parsedBody = z
    .string()
    .trim()
    .min(settings.courseRequests.commentMinLength, `Comment must be at least ${settings.courseRequests.commentMinLength} characters.`)
    .max(settings.courseRequests.commentMaxLength, `Comment must be under ${settings.courseRequests.commentMaxLength} characters.`)
    .safeParse(body);
  if (!parsedBody.success) {
    return { ok: false, error: parsedBody.error.issues[0]?.message ?? "Invalid comment" };
  }

  const existing = await db.requestComment.findUnique({ where: { id: parsedId.data } });
  if (!existing || existing.status === "DELETED") return { ok: false, error: "Comment not found." };
  if (existing.userId !== user.id) return { ok: false, error: "You can only edit your own comments." };

  const trimmed = parsedBody.data;
  const check = settings.courseRequests.profanityFilterEnabled
    ? checkContent(trimmed)
    : { flagged: false, reasons: [] as string[] };

  const comment = await db.requestComment.update({
    where: { id: parsedId.data },
    data: {
      body: trimmed,
      editedAt: new Date(),
      status: check.flagged ? "HIDDEN" : existing.status === "HIDDEN" ? "HIDDEN" : "VISIBLE",
    },
    select: requestCommentSelect,
  });

  const [withReactions] = await attachRequestCommentReactions([comment], user.id);
  return { ok: true, id: parsedId.data, comment: toRequestCommentDTO(withReactions, user.id) };
}

export async function deleteRequestCommentAction(commentId: unknown): Promise<ActionResult> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;
  const parsed = idSchema.safeParse(commentId);
  if (!parsed.success) return { ok: false, error: "Invalid comment" };

  const existing = await db.requestComment.findUnique({
    where: { id: parsed.data },
    select: { userId: true, requestId: true, status: true },
  });
  if (!existing) return { ok: false, error: "Comment not found." };
  if (existing.userId !== user.id) return { ok: false, error: "You can only delete your own comments." };

  await db.$transaction([
    db.requestComment.update({ where: { id: parsed.data }, data: { status: "DELETED" } }),
    ...(existing.status === "VISIBLE"
      ? [db.courseRequest.update({ where: { id: existing.requestId }, data: { commentCount: { decrement: 1 } } })]
      : []),
  ]);
  return { ok: true };
}

export async function toggleRequestCommentReactionAction(
  input: unknown
): Promise<ActionResult & { reacted?: boolean }> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;

  const parsed = requestCommentReactionSchema.safeParse(input);
  if (!parsed.success || !isValidChatEmoji(parsed.data.emoji)) {
    return { ok: false, error: "Invalid reaction" };
  }
  const { commentId, emoji } = parsed.data;

  const comment = await db.requestComment.findUnique({ where: { id: commentId }, select: { status: true } });
  if (!comment || comment.status !== "VISIBLE") return { ok: false, error: "Comment not found." };

  const existing = await db.requestCommentReaction.findUnique({
    where: { commentId_userId_emoji: { commentId, userId: user.id, emoji } },
  });

  if (existing) {
    await db.requestCommentReaction.delete({ where: { id: existing.id } });
    return { ok: true, reacted: false };
  }
  await db.requestCommentReaction.create({ data: { commentId, userId: user.id, emoji } });
  return { ok: true, reacted: true };
}
