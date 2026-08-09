import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { extractMentionIds } from "@/lib/chat";
import type {
  RequestAuthorDTO,
  RequestCardDTO,
  RequestDetailDTO,
  RequestCommentDTO,
  RequestCommentAuthorDTO,
  RequestStatus,
  RequestKind,
  RequestSort,
} from "@/lib/request-shared";
import type { ListCourseRequestsQuery } from "@/lib/validation";

/** Never select email or raw IP for anything rendered publicly. */
export const requestAuthorSelect = {
  id: true,
  name: true,
  image: true,
} satisfies Prisma.UserSelect;

type RequestAuthorRow = Prisma.UserGetPayload<{ select: typeof requestAuthorSelect }>;

/** Anonymous posting hides the real name/avatar regardless of role — the row still keeps a real userId for edit rights and abuse tracing. */
export function resolveRequestAuthor(user: RequestAuthorRow, anonymous: boolean): RequestAuthorDTO {
  if (anonymous) return { label: "Anonymous", image: null, isAnonymous: true };
  return { label: user.name, image: user.image, isAnonymous: false };
}

export const courseRequestSelect = {
  id: true,
  slug: true,
  userId: true,
  kind: true,
  title: true,
  subject: true,
  description: true,
  motivation: true,
  categoryId: true,
  category: { select: { slug: true, name: true } },
  skillLevel: true,
  instructor: true,
  sourceProvider: true,
  referenceUrl: true,
  tags: true,
  imageUrl: true,
  imageThumbUrl: true,
  anonymous: true,
  status: true,
  moderationStatus: true,
  pinned: true,
  featured: true,
  commentsLocked: true,
  views: true,
  voteCount: true,
  bookmarkCount: true,
  commentCount: true,
  mergedIntoId: true,
  createdAt: true,
  updatedAt: true,
  lastActivityAt: true,
  user: { select: requestAuthorSelect },
} satisfies Prisma.CourseRequestSelect;

export type CourseRequestRow = Prisma.CourseRequestGetPayload<{ select: typeof courseRequestSelect }>;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function isPopularRequest(voteCount: number, commentCount: number, threshold: number): boolean {
  return voteCount >= threshold || commentCount >= Math.ceil(threshold / 2);
}

export interface RequestDtoOpts {
  votedByMe: boolean;
  bookmarkedByMe: boolean;
  followedByMe: boolean;
  currentUserId: string | null;
  popularThreshold: number;
}

export function toRequestCard(row: CourseRequestRow, opts: RequestDtoOpts): RequestCardDTO {
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind as RequestKind,
    title: row.title,
    subject: row.subject,
    description: truncate(row.description, 220),
    category: row.category,
    skillLevel: row.skillLevel,
    tags: row.tags,
    imageThumbUrl: row.imageThumbUrl,
    status: row.status as RequestStatus,
    pinned: row.pinned,
    featured: row.featured,
    isPopular: isPopularRequest(row.voteCount, row.commentCount, opts.popularThreshold),
    voteCount: row.voteCount,
    bookmarkCount: row.bookmarkCount,
    commentCount: row.commentCount,
    views: row.views,
    mergedIntoId: row.mergedIntoId,
    createdAt: row.createdAt.toISOString(),
    lastActivityAt: row.lastActivityAt.toISOString(),
    author: resolveRequestAuthor(row.user, row.anonymous),
    votedByMe: opts.votedByMe,
    bookmarkedByMe: opts.bookmarkedByMe,
    followedByMe: opts.followedByMe,
    mine: opts.currentUserId !== null && opts.currentUserId === row.userId,
  };
}

export function toRequestDetail(row: CourseRequestRow, opts: RequestDtoOpts): RequestDetailDTO {
  return {
    ...toRequestCard(row, opts),
    description: row.description,
    motivation: row.motivation,
    instructor: row.instructor,
    sourceProvider: row.sourceProvider,
    referenceUrl: row.referenceUrl,
    imageUrl: row.imageUrl,
    commentsLocked: row.commentsLocked,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type RequestGuardResult = { ok: true } | { ok: false; error: string };

/** Live re-check of disabled/requestBanned — same rationale as assertCanPostChat: JWT sessions are stateless, so a ban must be re-verified on every write, not just at sign-in. */
export async function assertCanPostRequest(userId: string): Promise<RequestGuardResult> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { disabled: true, requestBanned: true },
  });
  if (!user || user.disabled) {
    return { ok: false, error: "Your session has expired or your account is unavailable. Please sign in again." };
  }
  if (user.requestBanned) {
    return { ok: false, error: "You've been restricted from posting in Course Requests." };
  }
  return { ok: true };
}

function requestOrderBy(sort: RequestSort): Prisma.CourseRequestOrderByWithRelationInput[] {
  switch (sort) {
    case "popular":
      return [{ pinned: "desc" }, { voteCount: "desc" }, { createdAt: "desc" }, { id: "asc" }];
    case "updated":
      return [{ pinned: "desc" }, { lastActivityAt: "desc" }, { id: "asc" }];
    case "trending":
      // Recent activity is filtered separately (see listCourseRequests); the
      // ordering within that window favors combined vote+comment momentum.
      return [{ pinned: "desc" }, { voteCount: "desc" }, { commentCount: "desc" }, { lastActivityAt: "desc" }, { id: "asc" }];
    case "newest":
    default:
      return [{ pinned: "desc" }, { createdAt: "desc" }, { id: "asc" }];
  }
}

const TRENDING_WINDOW_DAYS = 14;

export async function listCourseRequests(
  query: ListCourseRequestsQuery,
  currentUserId: string | null
): Promise<{ items: CourseRequestRow[]; nextCursor: string | null; total: number }> {
  const where: Prisma.CourseRequestWhereInput = { moderationStatus: "VISIBLE" };

  if (query.q) {
    const words = query.q.trim().split(/\s+/).slice(0, 8);
    where.AND = words.map((word) => ({
      OR: [
        { title: { contains: word, mode: "insensitive" as const } },
        { subject: { contains: word, mode: "insensitive" as const } },
        { description: { contains: word, mode: "insensitive" as const } },
        { tags: { has: word.toLowerCase() } },
      ],
    }));
  }
  if (query.category) where.category = { slug: query.category };
  if (query.tag) where.tags = { has: query.tag };
  if (query.level) where.skillLevel = query.level;
  if (query.status) where.status = query.status;
  if (query.kind) where.kind = query.kind;
  if (query.mine && currentUserId) where.userId = currentUserId;
  if (query.bookmarked && currentUserId) where.bookmarks = { some: { userId: currentUserId } };
  if (query.following && currentUserId) where.followers = { some: { userId: currentUserId } };
  if (query.sort === "trending") {
    where.lastActivityAt = { gte: new Date(Date.now() - TRENDING_WINDOW_DAYS * 86_400_000) };
  }

  const [total, items] = await Promise.all([
    db.courseRequest.count({ where }),
    db.courseRequest.findMany({
      where,
      select: courseRequestSelect,
      orderBy: requestOrderBy(query.sort),
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    }),
  ]);

  let nextCursor: string | null = null;
  if (items.length > query.limit) {
    const next = items.pop()!;
    nextCursor = next.id;
  }
  return { items, nextCursor, total };
}

/** All categories (not scoped to "has requests") — a sparse new feature shouldn't hide legitimate options from the create form or filter bar. */
export async function getRequestCategories(): Promise<{ id: string; slug: string; name: string }[]> {
  return db.category.findMany({
    orderBy: { order: "asc" },
    select: { id: true, slug: true, name: true },
  });
}

/** Hidden/deleted requests' comments must not be fetchable by ID alone — only the owner or staff can still see them, same rule as the detail page. */
export async function canViewRequestComments(requestId: string, userId: string | null): Promise<boolean> {
  const request = await db.courseRequest.findUnique({
    where: { id: requestId },
    select: { userId: true, moderationStatus: true },
  });
  if (!request || request.moderationStatus === "DELETED") return false;
  if (request.moderationStatus === "VISIBLE") return true;
  if (!userId) return false;
  if (userId === request.userId) return true;
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role === "ADMIN" || user?.role === "EDITOR";
}

export async function getCourseRequestBySlug(slug: string): Promise<CourseRequestRow | null> {
  return db.courseRequest.findFirst({
    where: { slug, moderationStatus: { not: "DELETED" } },
    select: courseRequestSelect,
  });
}

export interface MyRequestState {
  voted: boolean;
  bookmarked: boolean;
  followed: boolean;
}

/** Batched — one IN query each for votes/bookmarks/follows across a whole page, never N+1. */
export async function attachMyRequestState<T extends { id: string }>(
  items: T[],
  userId: string | null
): Promise<Map<string, MyRequestState>> {
  const result = new Map<string, MyRequestState>();
  for (const item of items) result.set(item.id, { voted: false, bookmarked: false, followed: false });
  if (!userId || items.length === 0) return result;

  const ids = items.map((i) => i.id);
  const [votes, bookmarks, follows] = await Promise.all([
    db.requestVote.findMany({ where: { userId, requestId: { in: ids } }, select: { requestId: true } }),
    db.requestBookmark.findMany({ where: { userId, requestId: { in: ids } }, select: { requestId: true } }),
    db.requestFollow.findMany({ where: { userId, requestId: { in: ids } }, select: { requestId: true } }),
  ]);
  for (const v of votes) result.get(v.requestId)!.voted = true;
  for (const b of bookmarks) result.get(b.requestId)!.bookmarked = true;
  for (const f of follows) result.get(f.requestId)!.followed = true;
  return result;
}

// --- Comments on requests ---

export const requestCommentAuthorSelect = {
  id: true,
  name: true,
  image: true,
  role: true,
} satisfies Prisma.UserSelect;

export const requestCommentSelect = {
  id: true,
  requestId: true,
  userId: true,
  parentId: true,
  body: true,
  status: true,
  createdAt: true,
  editedAt: true,
  user: { select: requestCommentAuthorSelect },
  _count: { select: { replies: { where: { status: "VISIBLE" } } } },
} satisfies Prisma.RequestCommentSelect;

export type RequestCommentRow = Prisma.RequestCommentGetPayload<{ select: typeof requestCommentSelect }>;

export async function listRequestComments(
  requestId: string,
  opts: { cursor?: string | null; limit?: number } = {}
): Promise<{ items: RequestCommentRow[]; nextCursor: string | null }> {
  const limit = Math.min(opts.limit ?? 20, 50);
  const items = await db.requestComment.findMany({
    where: {
      requestId,
      parentId: null,
      OR: [{ status: "VISIBLE" }, { status: "DELETED", replies: { some: { status: "VISIBLE" } } }],
    },
    select: requestCommentSelect,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
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

export async function listRequestCommentReplies(
  parentId: string,
  cursor?: string | null,
  limit = 10
): Promise<{ items: RequestCommentRow[]; nextCursor: string | null }> {
  const items = await db.requestComment.findMany({
    where: { parentId, status: "VISIBLE" },
    select: requestCommentSelect,
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

export interface RequestCommentReactionSummary {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

/** Batched, never N+1: one groupBy + one membership query for the whole page — mirrors chat.ts's attachReactionSummary for ChatReaction. */
export async function attachRequestCommentReactions<T extends { id: string }>(
  items: T[],
  userId: string | null
): Promise<(T & { reactions: RequestCommentReactionSummary[] })[]> {
  if (items.length === 0) return items.map((item) => ({ ...item, reactions: [] }));
  const ids = items.map((item) => item.id);
  const [grouped, mine] = await Promise.all([
    db.requestCommentReaction.groupBy({
      by: ["commentId", "emoji"],
      where: { commentId: { in: ids } },
      _count: { emoji: true },
    }),
    userId
      ? db.requestCommentReaction.findMany({
          where: { userId, commentId: { in: ids } },
          select: { commentId: true, emoji: true },
        })
      : Promise.resolve([]),
  ]);
  const mineSet = new Set(mine.map((m) => `${m.commentId}:${m.emoji}`));
  const byComment = new Map<string, RequestCommentReactionSummary[]>();
  for (const g of grouped) {
    const list = byComment.get(g.commentId) ?? [];
    list.push({ emoji: g.emoji, count: g._count.emoji, reactedByMe: mineSet.has(`${g.commentId}:${g.emoji}`) });
    byComment.set(g.commentId, list);
  }
  return items.map((item) => ({ ...item, reactions: byComment.get(item.id) ?? [] }));
}

function resolveRequestCommentAuthor(user: {
  name: string;
  image: string | null;
  role: string;
}): RequestCommentAuthorDTO {
  return { label: user.name, image: user.image, isAdmin: user.role === "ADMIN" || user.role === "EDITOR" };
}

export function toRequestCommentDTO(
  row: RequestCommentRow & { reactions: RequestCommentReactionSummary[] },
  currentUserId: string | null
): RequestCommentDTO {
  return {
    id: row.id,
    requestId: row.requestId,
    parentId: row.parentId,
    body: row.status === "DELETED" ? "" : row.body,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt ? row.editedAt.toISOString() : null,
    author: resolveRequestCommentAuthor(row.user),
    mine: currentUserId !== null && currentUserId === row.userId,
    reactions: row.reactions,
    replyCount: row._count.replies,
  };
}

export async function resolveRequestMentionDisplays(ids: string[]): Promise<Record<string, RequestCommentAuthorDTO>> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return {};
  const users = await db.user.findMany({ where: { id: { in: uniqueIds } }, select: requestCommentAuthorSelect });
  const map: Record<string, RequestCommentAuthorDTO> = {};
  for (const user of users) map[user.id] = resolveRequestCommentAuthor(user);
  return map;
}

export { extractMentionIds };

export interface UserRequestStats {
  createdCount: number;
  resolvedCount: number;
  bookmarkedCount: number;
  followingCount: number;
  votedCount: number;
  /** Simple, on-read reputation score — not stored/denormalized (a low-traffic profile page doesn't need a maintained counter). */
  reputation: number;
}

export async function getUserRequestStats(userId: string): Promise<UserRequestStats> {
  const [createdCount, resolvedCount, bookmarkedCount, followingCount, votedCount, votesReceived, commentsPosted] =
    await Promise.all([
      db.courseRequest.count({ where: { userId, moderationStatus: { not: "DELETED" } } }),
      db.courseRequest.count({ where: { userId, status: "RESOLVED", moderationStatus: { not: "DELETED" } } }),
      db.requestBookmark.count({ where: { userId } }),
      db.requestFollow.count({ where: { userId } }),
      db.requestVote.count({ where: { userId } }),
      db.courseRequest.aggregate({
        where: { userId, moderationStatus: { not: "DELETED" } },
        _sum: { voteCount: true },
      }),
      db.requestComment.count({ where: { userId, status: "VISIBLE" } }),
    ]);

  const reputation = (votesReceived._sum.voteCount ?? 0) * 3 + resolvedCount * 15 + commentsPosted * 1;

  return { createdCount, resolvedCount, bookmarkedCount, followingCount, votedCount, reputation };
}
