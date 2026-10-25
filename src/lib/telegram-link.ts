import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

/**
 * Website <-> Telegram account linking.
 *
 * The site mints a random token, keeps only its SHA-256, and hands the raw
 * value to the user as a t.me deep link. The bot's /start handler consumes it
 * once, within ten minutes, for whichever Telegram account actually pressed
 * Start — so a Telegram id can only ever be attached by the person holding
 * that Telegram account, never typed in by someone else.
 */

const TTL_MS = 10 * 60 * 1000;
/** Tokens a user may mint per hour; the action also rate-limits. */
const MAX_TOKENS_PER_HOUR = 5;
export const LINK_PREFIX = "link_";

function hash(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function createLinkToken(userId: string): Promise<string | null> {
  const recent = await db.telegramLinkToken.count({
    where: { userId, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= MAX_TOKENS_PER_HOUR) return null;
  // 32 bytes -> 43 base64url chars; with the prefix this stays inside
  // Telegram's 64-char [A-Za-z0-9_-] start-parameter limit.
  const raw = randomBytes(32).toString("base64url");
  await db.telegramLinkToken.create({
    data: { userId, tokenHash: hash(raw), expiresAt: new Date(Date.now() + TTL_MS) },
  });
  return raw;
}

export type LinkResult = { ok: true; userName: string } | { ok: false; reason: "invalid" | "expired" };

export async function consumeLinkToken(raw: string, telegramId: string): Promise<LinkResult> {
  if (!/^[A-Za-z0-9_-]{20,60}$/.test(raw) || !/^\d{1,20}$/.test(telegramId)) return { ok: false, reason: "invalid" };
  const tokenHash = hash(raw);
  return db.$transaction(async (tx) => {
    const row = await tx.telegramLinkToken.findUnique({ where: { tokenHash } });
    if (!row || row.usedAt) return { ok: false, reason: "invalid" } as const;
    if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" } as const;
    // Single use: only one consumer can flip usedAt.
    const { count } = await tx.telegramLinkToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count !== 1) return { ok: false, reason: "invalid" } as const;
    const owner = await tx.user.findUnique({ where: { id: row.userId }, select: { disabled: true } });
    if (!owner || owner.disabled) return { ok: false, reason: "invalid" } as const;
    // A Telegram account belongs to one website account: move it if needed.
    await tx.user.updateMany({ where: { telegramId, id: { not: row.userId } }, data: { telegramId: null } });
    const user = await tx.user.update({ where: { id: row.userId }, data: { telegramId }, select: { name: true } });
    return { ok: true, userName: user.name } as const;
  });
}

export async function findLinkedUser(telegramId: string) {
  return db.user.findFirst({
    where: { telegramId, disabled: false },
    select: { id: true, name: true, premiumUntil: true },
  });
}
