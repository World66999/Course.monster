import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type NotificationType =
  | "REQUEST_COMMENT"
  | "REQUEST_REPLY"
  | "REQUEST_MENTION"
  | "REQUEST_STATUS_CHANGE"
  | "ADMIN_RESPONSE";

export interface NotificationDTO {
  id: string;
  type: NotificationType;
  requestId: string | null;
  requestSlug: string | null;
  requestTitle: string | null;
  message: string;
  read: boolean;
  createdAt: string;
}

const notificationSelect = {
  id: true,
  type: true,
  requestId: true,
  message: true,
  read: true,
  createdAt: true,
  request: { select: { slug: true, title: true } },
} satisfies Prisma.NotificationSelect;

type NotificationRow = Prisma.NotificationGetPayload<{ select: typeof notificationSelect }>;

function toDTO(row: NotificationRow): NotificationDTO {
  return {
    id: row.id,
    type: row.type as NotificationType,
    requestId: row.requestId,
    requestSlug: row.request?.slug ?? null,
    requestTitle: row.request?.title ?? null,
    message: row.message,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Fire-and-forget by design: notification delivery must never block or
 * fail the action that triggered it (a comment/vote/status-change still
 * succeeds even if this write fails). In-app only, no email — see the
 * final report's remaining recommendations for why.
 */
export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  message: string;
  requestId?: string | null;
  commentId?: string | null;
  actorId?: string | null;
}): Promise<void> {
  // Never notify a user about their own action.
  if (input.actorId && input.actorId === input.userId) return;
  try {
    await db.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        message: input.message,
        requestId: input.requestId ?? null,
        commentId: input.commentId ?? null,
        actorId: input.actorId ?? null,
      },
    });
  } catch (err) {
    console.error("[notifications] failed to create:", err);
  }
}

/**
 * Fans out a notification to everyone following a request (which includes
 * its owner — see createCourseRequestAction's auto-follow), excluding the
 * user who triggered it. One query for the follower list, then reuses
 * createNotification's own fire-and-forget/no-self-notify guarantees.
 */
export async function notifyFollowers(input: {
  requestId: string;
  type: NotificationType;
  message: string;
  actorId: string;
  commentId?: string | null;
  /** Skip these on top of the actor — e.g. a reply's parent-comment author, who already gets a more specific REQUEST_REPLY notification. */
  excludeUserIds?: string[];
}): Promise<void> {
  try {
    const exclude = new Set([input.actorId, ...(input.excludeUserIds ?? [])]);
    const followers = await db.requestFollow.findMany({
      where: { requestId: input.requestId, userId: { notIn: [...exclude] } },
      select: { userId: true },
    });
    await Promise.all(
      followers.map((f) =>
        createNotification({
          userId: f.userId,
          type: input.type,
          message: input.message,
          requestId: input.requestId,
          commentId: input.commentId,
          actorId: input.actorId,
        })
      )
    );
  } catch (err) {
    console.error("[notifications] follower fan-out failed:", err);
  }
}

export async function listNotifications(
  userId: string,
  opts: { cursor?: string | null; limit?: number } = {}
): Promise<{ items: NotificationDTO[]; nextCursor: string | null; unreadCount: number }> {
  const limit = Math.min(opts.limit ?? 20, 50);
  const [items, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { userId },
      select: notificationSelect,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    }),
    db.notification.count({ where: { userId, read: false } }),
  ]);
  let nextCursor: string | null = null;
  if (items.length > limit) {
    const next = items.pop()!;
    nextCursor = next.id;
  }
  return { items: items.map(toDTO), nextCursor, unreadCount };
}

export async function markNotificationsRead(userId: string, ids?: string[]): Promise<void> {
  await db.notification.updateMany({
    where: { userId, ...(ids && ids.length > 0 ? { id: { in: ids } } : {}) },
    data: { read: true },
  });
}
