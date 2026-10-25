import "server-only";
import { db } from "@/lib/db";
import { sendMessage, type InlineKeyboard } from "./api";
import { adminIds, hasBotToken } from "./config";
import { markBotBlocked } from "./users";

/**
 * Outbound notifications to website users who linked their Telegram account,
 * and to the bot admins. Best effort by design: a notification failing (bot
 * not configured, user blocked the bot, Telegram down) must never fail the
 * payment, ticket reply or job that triggered it. Callers pass already
 * HTML-escaped text.
 */

export async function notifyUser(
  userId: string,
  text: string,
  keyboard?: InlineKeyboard
): Promise<boolean> {
  if (!hasBotToken()) return false;
  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { telegramId: true } });
    if (!user?.telegramId) return false;
    const res = await sendMessage(user.telegramId, text, { replyMarkup: keyboard });
    if (!res.ok && res.status === 403) await markBotBlocked(user.telegramId);
    return res.ok;
  } catch (err) {
    console.error("[notify] user notification failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

export async function notifyAdmins(text: string): Promise<void> {
  if (!hasBotToken()) return;
  await Promise.all(
    [...adminIds()].map((id) =>
      sendMessage(id, text).catch((err) => {
        console.error("[notify] admin notification failed:", err instanceof Error ? err.message : err);
      })
    )
  );
}
