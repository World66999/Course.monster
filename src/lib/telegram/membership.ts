import "server-only";
import { callTelegram } from "./api";

/**
 * Required-channel membership gate.
 *
 * Telegram documents that getChatMember "is only guaranteed to work for other
 * users if the bot is an administrator in the chat" — the bot is an admin of
 * the configured channel, which is what makes this reliable.
 *
 * The check is always server-side. Nothing a client can influence (callback
 * data, button text, deep-link parameters, a claimed "joined" flag) is ever
 * consulted, and an API failure never grants access.
 */

export type MembershipState = "member" | "not-member" | "unavailable";

export interface MembershipResult {
  state: MembershipState;
  /** Raw Telegram status, for admin diagnostics only. Never shown to users. */
  status?: string;
}

export function requiredChannel(): string | null {
  const c = process.env.TELEGRAM_REQUIRED_CHANNEL?.trim();
  return c && c.length > 0 ? c : null;
}

export function requiredChannelUrl(): string {
  return process.env.TELEGRAM_REQUIRED_CHANNEL_URL?.trim() || "https://t.me/Matrix_Bots_in";
}

/** No channel configured means the gate is disabled entirely. */
export function gateEnabled(): boolean {
  return requiredChannel() !== null;
}

/**
 * Short-lived positive cache.
 *
 * Deliberately brief: a long cache would let someone leave the channel and keep
 * access. Only *membership* is cached — a negative result is never cached, so a
 * user who has just joined is never told "not a member" from a stale entry.
 * Process-local by design; losing it on a deploy simply causes a fresh check.
 */
const TTL_MS = 45_000;
const cache = new Map<string, number>();

/**
 * An entry is normally dropped when it is next read after expiry — but a user
 * who checks once and never comes back is never read again, so the map only
 * ever grew. It is swept whenever it gets large instead: expired entries first,
 * and if that is not enough (every entry still live) the oldest are evicted, so
 * the map has a hard ceiling. Evicting early is safe — the only cost is one
 * extra getChatMember call, and dropping an entry can never grant access.
 */
const MAX_ENTRIES = 5_000;

function sweep(now: number): void {
  for (const [id, until] of cache) {
    if (now > until) cache.delete(id);
  }
  if (cache.size <= MAX_ENTRIES) return;
  // Map preserves insertion order, so the head is the least recently written.
  const excess = cache.size - MAX_ENTRIES;
  let dropped = 0;
  for (const id of cache.keys()) {
    cache.delete(id);
    if (++dropped >= excess) break;
  }
}

export function invalidateMembership(telegramId: string): void {
  cache.delete(telegramId);
}

function cachedMember(telegramId: string): boolean {
  const until = cache.get(telegramId);
  if (until === undefined) return false;
  if (Date.now() > until) {
    cache.delete(telegramId);
    return false;
  }
  return true;
}

interface ChatMember {
  status: string;
  is_member?: boolean;
}

/**
 * Resolves membership.
 *
 * `creator`, `administrator` and `member` count as joined. `restricted` counts
 * only when Telegram reports the user is still a member. `left` and `kicked`
 * do not. An API error yields "unavailable" rather than either answer, so a
 * Telegram outage can neither lock everyone out silently nor open the gate.
 */
export async function checkMembership(
  telegramId: string,
  opts: { fresh?: boolean } = {}
): Promise<MembershipResult> {
  const channel = requiredChannel();
  if (!channel) return { state: "member", status: "gate-disabled" };

  if (opts.fresh) invalidateMembership(telegramId);
  else if (cachedMember(telegramId)) return { state: "member", status: "cached" };

  const res = await callTelegram<ChatMember>("getChatMember", {
    chat_id: channel,
    user_id: Number(telegramId),
  });

  if (!res.ok) {
    // "user not found" means Telegram knows the user isn't in the channel;
    // anything else is a genuine failure and must not be treated as a refusal.
    if (/user not found|PARTICIPANT_ID_INVALID/i.test(res.description)) {
      return { state: "not-member", status: "not-found" };
    }
    console.error(`[telegram] membership check failed for the required channel: ${res.description}`);
    return { state: "unavailable" };
  }

  const status = res.result.status;
  const joined =
    status === "creator" ||
    status === "administrator" ||
    status === "member" ||
    (status === "restricted" && res.result.is_member === true);

  if (joined) {
    const now = Date.now();
    if (cache.size >= MAX_ENTRIES) sweep(now);
    cache.set(telegramId, now + TTL_MS);
  } else invalidateMembership(telegramId);

  return { state: joined ? "member" : "not-member", status };
}

/** Cache size, for the admin health readout. */
export function membershipCacheSize(): number {
  return cache.size;
}
