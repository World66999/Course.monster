import "server-only";
import { db } from "@/lib/db";
import type { TelegramEventType } from "@prisma/client";

/** Telegram's `from` object, narrowed to the fields we are willing to store. */
export interface TelegramFrom {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface BotUser {
  id: string;
  telegramId: string;
  blocked: boolean;
}

/**
 * Upserts the Telegram identity and refreshes `lastSeenAt`.
 *
 * Only the profile fields Telegram volunteers are stored — no phone number, no
 * message content, no chat history.
 */
export async function touchUser(from: TelegramFrom): Promise<BotUser> {
  const telegramId = String(from.id);
  const profile = {
    username: from.username ?? null,
    firstName: from.first_name ?? null,
    lastName: from.last_name ?? null,
  };
  const user = await db.telegramUser.upsert({
    where: { telegramId },
    // A returning user is no longer "blocked by the bot" if they message us.
    update: { ...profile, lastSeenAt: new Date(), botBlocked: false },
    create: { telegramId, ...profile },
    select: { id: true, telegramId: true, blocked: true },
  });
  return user;
}

export async function recordEvent(
  userId: string,
  type: TelegramEventType,
  extra: { courseId?: string; query?: string } = {}
): Promise<void> {
  try {
    await db.telegramEvent.create({
      data: {
        userId,
        type,
        courseId: extra.courseId ?? null,
        query: extra.query ? extra.query.slice(0, 100) : null,
      },
    });
  } catch (err) {
    // Analytics must never break a user's interaction.
    console.error("[telegram] failed to record event:", err);
  }
}

export async function rememberSearch(userId: string, query: string): Promise<void> {
  await db.telegramUser.update({
    where: { id: userId },
    data: { lastSearch: query.slice(0, 100), lastSearchAt: new Date() },
  });
}

export async function lastSearch(userId: string): Promise<string | null> {
  const row = await db.telegramUser.findUnique({ where: { id: userId }, select: { lastSearch: true } });
  return row?.lastSearch ?? null;
}

/** Marks a user who has blocked the bot so broadcasts stop targeting them. */
export async function markBotBlocked(telegramId: string): Promise<void> {
  await db.telegramUser
    .update({ where: { telegramId }, data: { botBlocked: true } })
    .catch(() => undefined);
}
