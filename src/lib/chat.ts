import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isStaff } from "@/lib/roles";

import { parseMessageSegments, type ChatMessagesResponse } from "@/lib/chat-shared";

export { CHAT_EMOJI, isValidChatEmoji, containsUrl } from "@/lib/chat-shared";

/** Never select email/passwordHash/raw ip for anything rendered publicly. */
export const chatAuthorSelect = {
  id: true,
  name: true,
  image: true,
  chatDisplayName: true,
  role: true,
} satisfies Prisma.UserSelect;

type ChatAuthorRow = Prisma.UserGetPayload<{ select: typeof chatAuthorSelect }>;

export interface ChatAuthorDisplay {
  label: string;
  isAdmin: boolean;
  image: string | null;
}

/**
 * Staff show only as "Admin" — their real name/email/avatar must never
 * reach a public response (a real profile photo would partially
 * deanonymize them even without a name attached).
 */
export function resolveChatAuthorDisplay(user: ChatAuthorRow): ChatAuthorDisplay {
  if (isStaff(user.role)) {
    return { label: "Admin", isAdmin: true, image: null };
  }
  return { label: user.chatDisplayName ?? user.name, isAdmin: false, image: user.image };
}

export const chatMessageSelect = {
  id: true,
  userId: true,
  parentId: true,
  body: true,
  imageUrl: true,
  imageThumbUrl: true,
  status: true,
  linkPending: true,
  createdAt: true,
  editedAt: true,
  user: { select: chatAuthorSelect },
} satisfies Prisma.ChatMessageSelect;

export type ChatMessageWithAuthor = Prisma.ChatMessageGetPayload<{ select: typeof chatMessageSelect }>;

export type ChatGuardResult = { ok: true } | { ok: false; error: string };

/**
 * Live re-check of disabled/chatBanned/chatMutedUntil — same rationale as
 * auth-helpers.ts's isDisabled(): sessions are stateless JWTs, so a ban/mute
 * applied by an admin must be re-verified against the DB on every post, not
 * just at sign-in.
 */
export async function assertCanPostChat(userId: string): Promise<ChatGuardResult> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { disabled: true, chatBanned: true, chatMutedUntil: true },
  });
  if (!user || user.disabled) {
    return {
      ok: false,
      error: "Your session has expired or your account is unavailable. Please sign in again.",
    };
  }
  if (user.chatBanned) {
    return { ok: false, error: "You've been banned from chat." };
  }
  if (user.chatMutedUntil && user.chatMutedUntil.getTime() > Date.now()) {
    return { ok: false, error: "You're temporarily muted from chat. Please try again later." };
  }
  return { ok: true };
}

export interface ListChatMessagesOptions {
  /** Cursor: load messages older than this id (descending "load more history"). */
  before?: string | null;
  /** Cursor: load messages newer than this id, ascending (polling for new messages). */
  after?: string | null;
  /**
   * Server-issued timestamp of the caller's previous poll. Used only as the
   * fallback lower bound when the `after` row can no longer be found at all
   * (its author's account was deleted, which cascades the message away).
   * Without it such a client polls forever and never sees another message.
   */
  since?: Date | null;
  q?: string;
  limit?: number;
}

export interface ListChatMessagesResult {
  items: ChatMessageWithAuthor[];
  nextCursor: string | null;
}

/**
 * Resolves a cursor id to the ordering values the feed is sorted by.
 *
 * Deliberately NOT filtered by the public `where`: the whole point is that the
 * anchor may since have been hidden or deleted, and its position in the
 * ordering is still exactly what the caller means by "after this one".
 */
async function cursorAnchor(id: string): Promise<{ createdAt: Date; id: string } | null> {
  return db.chatMessage.findUnique({ where: { id }, select: { createdAt: true, id: true } });
}

/** `(createdAt, id)` strictly after / before the anchor — a total order, so nothing ties. */
function afterAnchor(a: { createdAt: Date; id: string }): Prisma.ChatMessageWhereInput {
  return { OR: [{ createdAt: { gt: a.createdAt } }, { createdAt: a.createdAt, id: { gt: a.id } }] };
}
function beforeAnchor(a: { createdAt: Date; id: string }): Prisma.ChatMessageWhereInput {
  return { OR: [{ createdAt: { lt: a.createdAt } }, { createdAt: a.createdAt, id: { lt: a.id } }] };
}

/**
 * Public feed: always excludes hidden/deleted/link-pending messages.
 *
 * Paging is an explicit `(createdAt, id)` range rather than Prisma's
 * `cursor` + `skip: 1`. That form only behaves as intended while the cursor row
 * still satisfies `where` — and in a moderated live feed it routinely does not.
 * Prisma then positions at the first row *after* the (now filtered-out) anchor
 * and `skip: 1` throws that row away, so the message immediately following a
 * moderated one was silently dropped for every client currently polling, and
 * never came back because the cursor had already advanced past it. Reproduced
 * against a real database before this was changed.
 */
export async function listChatMessages(opts: ListChatMessagesOptions = {}): Promise<ListChatMessagesResult> {
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 50);
  const where: Prisma.ChatMessageWhereInput = {
    status: "VISIBLE",
    linkPending: false,
    ...(opts.q ? { body: { contains: opts.q, mode: "insensitive" } } : {}),
  };

  if (opts.after) {
    const anchor = await cursorAnchor(opts.after);
    const range = anchor
      ? afterAnchor(anchor)
      : opts.since
        ? { createdAt: { gt: opts.since } }
        : null;
    // No anchor and no timestamp to fall back on: nothing can be said about
    // what "newer" means, so report nothing rather than replay the whole feed.
    if (!range) return { items: [], nextCursor: null };
    const items = await db.chatMessage.findMany({
      where: { AND: [where, range] },
      select: chatMessageSelect,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit,
    });
    return { items, nextCursor: null };
  }

  let range: Prisma.ChatMessageWhereInput | null = null;
  if (opts.before) {
    const anchor = await cursorAnchor(opts.before);
    // An unknown "load older" cursor is not recoverable from a timestamp the
    // way the live cursor is, so answer with nothing more to load.
    if (!anchor) return { items: [], nextCursor: null };
    range = beforeAnchor(anchor);
  }

  const items = await db.chatMessage.findMany({
    where: range ? { AND: [where, range] } : where,
    select: chatMessageSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  let nextCursor: string | null = null;
  if (items.length > limit) {
    const next = items.pop()!;
    nextCursor = next.id;
  }
  return { items, nextCursor };
}

/**
 * Ids of messages that became invisible (hidden/deleted/link-pending) since
 * `since` — lets a polling client drop messages it already rendered when an
 * admin moderates them, not just filter them out of future fetches. Backed
 * by the ChatMessage.updatedAt index.
 */
export async function listRemovedMessageIds(since: Date): Promise<string[]> {
  const rows = await db.chatMessage.findMany({
    where: {
      updatedAt: { gt: since },
      OR: [{ status: { not: "VISIBLE" } }, { linkPending: true }],
    },
    select: { id: true },
    take: 500,
  });
  return rows.map((r) => r.id);
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

/** Batched, never N+1: one groupBy + one membership query for the whole page. */
export async function attachReactionSummary<T extends { id: string }>(
  items: T[],
  userId: string | null
): Promise<(T & { reactions: ReactionSummary[] })[]> {
  if (items.length === 0) return items.map((item) => ({ ...item, reactions: [] }));

  const ids = items.map((item) => item.id);
  const [grouped, mine] = await Promise.all([
    db.chatReaction.groupBy({
      by: ["messageId", "emoji"],
      where: { messageId: { in: ids } },
      _count: { emoji: true },
    }),
    userId
      ? db.chatReaction.findMany({
          where: { userId, messageId: { in: ids } },
          select: { messageId: true, emoji: true },
        })
      : Promise.resolve([]),
  ]);

  const mineSet = new Set(mine.map((m) => `${m.messageId}:${m.emoji}`));
  const byMessage = new Map<string, ReactionSummary[]>();
  for (const g of grouped) {
    const list = byMessage.get(g.messageId) ?? [];
    list.push({ emoji: g.emoji, count: g._count.emoji, reactedByMe: mineSet.has(`${g.messageId}:${g.emoji}`) });
    byMessage.set(g.messageId, list);
  }
  return items.map((item) => ({ ...item, reactions: byMessage.get(item.id) ?? [] }));
}

export interface ParentPreview {
  id: string;
  authorLabel: string;
  isAdmin: boolean;
  body: string;
  imageUrl: string | null;
}

/** Batched inline quote preview for replies — one IN query for the whole page. */
export async function attachParentPreview<T extends { id: string; parentId: string | null }>(
  items: T[]
): Promise<(T & { parentPreview: ParentPreview | null })[]> {
  const parentIds = [...new Set(items.map((i) => i.parentId).filter((id): id is string => Boolean(id)))];
  if (parentIds.length === 0) return items.map((item) => ({ ...item, parentPreview: null }));

  const parents = await db.chatMessage.findMany({
    where: { id: { in: parentIds } },
    select: { id: true, body: true, imageUrl: true, user: { select: chatAuthorSelect } },
  });
  const byId = new Map(
    parents.map((p) => {
      const display = resolveChatAuthorDisplay(p.user);
      return [
        p.id,
        { id: p.id, authorLabel: display.label, isAdmin: display.isAdmin, body: p.body, imageUrl: p.imageUrl },
      ] as const;
    })
  );
  return items.map((item) => ({
    ...item,
    parentPreview: item.parentId ? (byId.get(item.parentId) ?? null) : null,
  }));
}

export function extractMentionIds(text: string): string[] {
  return parseMessageSegments(text)
    .filter((s): s is Extract<typeof s, { type: "mention" }> => s.type === "mention")
    .map((s) => s.userId);
}

/** One batched IN query for every mention across a whole page of messages. */
export async function resolveMentionDisplays(ids: string[]): Promise<Record<string, ChatAuthorDisplay>> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return {};
  const users = await db.user.findMany({ where: { id: { in: uniqueIds } }, select: chatAuthorSelect });
  const map: Record<string, ChatAuthorDisplay> = {};
  for (const user of users) map[user.id] = resolveChatAuthorDisplay(user);
  return map;
}

/**
 * Shapes a page of messages for a client response: reactions, parent
 * previews, mention resolution, and stripping down to the public DTO shape
 * (never the raw `user`/`userId`). Shared by /api/chat/messages and the
 * chat page's initial SSR fetch so they can never drift apart.
 */
export async function toChatMessagesResponse(
  items: ChatMessageWithAuthor[],
  nextCursor: string | null,
  userId: string | null,
  /**
   * Captured by the caller *before* it queried, so a message moderated while
   * the query was in flight is reported on the next poll instead of falling
   * into the gap between the two.
   */
  serverTime: Date = new Date()
): Promise<ChatMessagesResponse> {
  const withReactions = await attachReactionSummary(items, userId);
  const withParents = await attachParentPreview(withReactions);

  const mentionIds = withParents.flatMap((item) => extractMentionIds(item.body));
  const mentions = await resolveMentionDisplays(mentionIds);

  const mapped = withParents.map((item) => {
    const author = resolveChatAuthorDisplay(item.user);
    return {
      id: item.id,
      parentId: item.parentId,
      body: item.body,
      imageUrl: item.imageUrl,
      imageThumbUrl: item.imageThumbUrl,
      createdAt: item.createdAt.toISOString(),
      editedAt: item.editedAt ? item.editedAt.toISOString() : null,
      author,
      mine: userId !== null && userId === item.userId,
      reactions: item.reactions,
      parentPreview: item.parentPreview,
    };
  });

  return { items: mapped, nextCursor, mentions, serverTime: serverTime.toISOString() };
}
