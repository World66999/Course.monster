/**
 * Chat helpers usable from both server and client code — deliberately no
 * "server-only" import and no DB access, unlike src/lib/chat.ts.
 */

export interface ChatAuthorDTO {
  label: string;
  isAdmin: boolean;
  image: string | null;
}

export interface ChatReactionDTO {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface ChatParentPreviewDTO {
  id: string;
  authorLabel: string;
  isAdmin: boolean;
  body: string;
  imageUrl: string | null;
}

export interface ChatMessageDTO {
  id: string;
  parentId: string | null;
  body: string;
  imageUrl: string | null;
  imageThumbUrl: string | null;
  createdAt: string;
  editedAt: string | null;
  author: ChatAuthorDTO;
  mine: boolean;
  reactions: ChatReactionDTO[];
  parentPreview: ChatParentPreviewDTO | null;
}

export interface ChatMessagesResponse {
  items: ChatMessageDTO[];
  nextCursor: string | null;
  mentions: Record<string, ChatAuthorDTO>;
  /** Ids of already-fetched messages that became invisible (hidden/deleted) since `since`. */
  removedIds?: string[];
  /**
   * The server's own clock at the moment this response was produced.
   *
   * The client echoes it back as `since` on the next poll. It must be the
   * server's time, not the browser's: `since` is compared against
   * `ChatMessage.updatedAt`, which is stamped server-side, so a browser clock
   * running even slightly fast made every moderation in that window fall
   * outside `updatedAt > since` and the hidden message stayed on screen until
   * a reload. Nothing about a visitor's device clock is knowable, so it is
   * never used as one end of a server-side comparison.
   */
  serverTime: string;
}

/** Curated set, validated server-side against this list — no picker dependency. */
export const CHAT_EMOJI = [
  "👍", "👎", "❤️", "🔥", "😂", "😮", "😢", "😡", "🎉", "🙏",
  "👏", "💯", "🚀", "👀", "😍", "🤔", "😎", "💀", "✅", "❌",
  "⭐", "🎯", "💡", "🙌",
] as const;

export function isValidChatEmoji(value: string): boolean {
  return (CHAT_EMOJI as readonly string[]).includes(value);
}

/** Any http(s):// or www. substring — kept in sync with the server-side check in chat.ts. */
const URL_RE = /https?:\/\/|www\./i;

export function containsUrl(text: string): boolean {
  return URL_RE.test(text);
}

/** Mention tokens are `@[<userId>]`, inserted by the composer's autocomplete. */
const MENTION_RE = /@\[([a-z0-9]{20,32})\]/gi;

export type MessageSegment = { type: "text"; text: string } | { type: "mention"; userId: string };

/** Splits a message body into plain-text and mention segments for safe (non-HTML) rendering. */
export function parseMessageSegments(body: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let lastIndex = 0;
  for (const match of body.matchAll(MENTION_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) segments.push({ type: "text", text: body.slice(lastIndex, index) });
    segments.push({ type: "mention", userId: match[1] });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < body.length) segments.push({ type: "text", text: body.slice(lastIndex) });
  return segments;
}
