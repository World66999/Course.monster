import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/** Never select email or raw IP for anything rendered publicly. */
export const commentAuthorSelect = {
  id: true,
  name: true,
  image: true,
  accounts: { where: { provider: "google" }, select: { id: true }, take: 1 },
  /**
   * Premium badge, same shape trick as `accounts`: a row means "currently a
   * member". Only the status is selected, never the expiry date, so a public
   * page can't reveal when someone's membership ends. ACTIVE flips to EXPIRED
   * within one scheduler tick (src/lib/premium-jobs.ts).
   */
  subscriptions: { where: { status: "ACTIVE" }, select: { status: true }, take: 1 },
} satisfies Prisma.UserSelect;

export const commentSelect = {
  id: true,
  courseId: true,
  parentId: true,
  body: true,
  status: true,
  likeCount: true,
  createdAt: true,
  editedAt: true,
  user: { select: commentAuthorSelect },
  _count: { select: { replies: { where: { status: "VISIBLE" } } } },
} satisfies Prisma.CommentSelect;

export type CommentWithAuthor = Prisma.CommentGetPayload<{ select: typeof commentSelect }>;

export type CommentSort = "newest" | "oldest" | "helpful";

function commentOrderBy(sort: CommentSort): Prisma.CommentOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "helpful":
      return [{ likeCount: "desc" }, { createdAt: "desc" }, { id: "asc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
}

export async function listTopLevelComments(
  courseId: string,
  opts: { sort?: CommentSort; cursor?: string | null; limit?: number } = {}
): Promise<{ items: CommentWithAuthor[]; nextCursor: string | null }> {
  const limit = Math.min(opts.limit ?? 20, 50);
  const items = await db.comment.findMany({
    where: {
      courseId,
      parentId: null,
      // A user-deleted top-level comment still renders as a "[deleted]"
      // placeholder if it has live replies, so thread structure survives.
      // Admin-hidden comments never show, even as a placeholder.
      OR: [{ status: "VISIBLE" }, { status: "DELETED", replies: { some: { status: "VISIBLE" } } }],
    },
    select: commentSelect,
    orderBy: commentOrderBy(opts.sort ?? "newest"),
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });

  let nextCursor: string | null = null;
  if (items.length > limit) {
    const next = items.pop()!;
    nextCursor = next.id;
  }
  return { items, nextCursor };
}

/** Cheap indexed count, fetched once for the initial page render (not on every paginate/sort). */
export async function getTopLevelCommentCount(courseId: string): Promise<number> {
  return db.comment.count({
    where: {
      courseId,
      parentId: null,
      OR: [{ status: "VISIBLE" }, { status: "DELETED", replies: { some: { status: "VISIBLE" } } }],
    },
  });
}

export async function listReplies(
  parentId: string,
  cursor?: string | null,
  limit = 10
): Promise<{ items: CommentWithAuthor[]; nextCursor: string | null }> {
  const items = await db.comment.findMany({
    where: { parentId, status: "VISIBLE" },
    select: commentSelect,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  let nextCursor: string | null = null;
  if (items.length > limit) {
    const next = items.pop()!;
    nextCursor = next.id;
  }
  return { items, nextCursor };
}

export const reviewSelect = {
  id: true,
  courseId: true,
  rating: true,
  title: true,
  body: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  user: { select: commentAuthorSelect },
} satisfies Prisma.ReviewSelect;

export type ReviewWithAuthor = Prisma.ReviewGetPayload<{ select: typeof reviewSelect }>;

export type ReviewSort = "newest" | "oldest" | "highest" | "lowest";

function reviewOrderBy(sort: ReviewSort): Prisma.ReviewOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "highest":
      return [{ rating: "desc" }, { createdAt: "desc" }, { id: "asc" }];
    case "lowest":
      return [{ rating: "asc" }, { createdAt: "desc" }, { id: "asc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
}

export async function listReviews(
  courseId: string,
  opts: { sort?: ReviewSort; cursor?: string | null; limit?: number } = {}
): Promise<{ items: ReviewWithAuthor[]; nextCursor: string | null }> {
  const limit = Math.min(opts.limit ?? 10, 30);
  const items = await db.review.findMany({
    where: { courseId, status: "VISIBLE" },
    select: reviewSelect,
    orderBy: reviewOrderBy(opts.sort ?? "newest"),
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });

  let nextCursor: string | null = null;
  if (items.length > limit) {
    const next = items.pop()!;
    nextCursor = next.id;
  }
  return { items, nextCursor };
}

export type CommentWithMeta = CommentWithAuthor & { likedByMe: boolean };

/** Merges in whether `userId` has liked each comment — one indexed IN query, never N+1. */
export async function attachLikedByMe(
  items: CommentWithAuthor[],
  userId: string | null
): Promise<CommentWithMeta[]> {
  if (!userId || items.length === 0) {
    return items.map((item) => ({ ...item, likedByMe: false }));
  }
  const liked = await db.commentLike.findMany({
    where: { userId, commentId: { in: items.map((item) => item.id) } },
    select: { commentId: true },
  });
  const likedIds = new Set(liked.map((l) => l.commentId));
  return items.map((item) => ({ ...item, likedByMe: likedIds.has(item.id) }));
}

export interface ReviewSummary {
  avgRating: number;
  reviewCount: number;
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
}

/** Reads the denormalized Course counters + one grouped count query — no full aggregation on read. */
export async function getReviewSummary(courseId: string): Promise<ReviewSummary> {
  const [course, grouped] = await Promise.all([
    db.course.findUnique({ where: { id: courseId }, select: { avgRating: true, reviewCount: true } }),
    db.review.groupBy({
      by: ["rating"],
      where: { courseId, status: "VISIBLE" },
      _count: { rating: true },
    }),
  ]);

  const breakdown: ReviewSummary["breakdown"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of grouped) {
    if (row.rating >= 1 && row.rating <= 5) {
      breakdown[row.rating as 1 | 2 | 3 | 4 | 5] = row._count.rating;
    }
  }

  return {
    avgRating: course?.avgRating ?? 0,
    reviewCount: course?.reviewCount ?? 0,
    breakdown,
  };
}

/** Recomputes Course.avgRating/reviewCount from Review rows. Call inside the same transaction as the write. */
export async function recomputeCourseRating(
  tx: Prisma.TransactionClient,
  courseId: string
): Promise<void> {
  const agg = await tx.review.aggregate({
    where: { courseId, status: "VISIBLE" },
    _avg: { rating: true },
    _count: { rating: true },
  });
  await tx.course.update({
    where: { id: courseId },
    data: {
      avgRating: agg._avg.rating ?? 0,
      reviewCount: agg._count.rating,
    },
  });
}
