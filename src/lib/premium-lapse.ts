import "server-only";
import { db } from "@/lib/db";
import { callTelegram } from "@/lib/telegram/api";
import { hasBotToken } from "@/lib/telegram/config";
import { isActiveUntil } from "@/lib/premium-period";
import { isStaff } from "@/lib/roles";

/**
 * What happens around Premium beyond the premiumUntil check itself.
 *
 * Access on the website never waits for this: every gate reads premiumUntil at
 * request time. These hooks clean up the things that live outside a request —
 * Telegram group membership and invite links, and the support priority flag —
 * and are called from every path that ends Premium (scheduled expiry, refund,
 * admin revoke) and that starts it (payment, admin grant). All are idempotent
 * and re-check the current state, so calling one at the wrong moment is a no-op.
 */

/** Whether this Telegram account may be in the private members' groups right now. */
export async function mayJoinPremiumGroups(telegramId: string): Promise<boolean> {
  const user = await db.user.findFirst({
    where: { telegramId, disabled: false },
    select: { premiumUntil: true, role: true, premiumChatBanned: true },
  });
  if (!user || user.premiumChatBanned) return false;
  return isActiveUntil(user.premiumUntil) || isStaff(user.role);
}

/** Removes a member from a group without a lasting ban, so they can rejoin after renewing. */
export async function kickFromGroup(chatId: string, telegramId: string): Promise<boolean> {
  const ban = await callTelegram("banChatMember", {
    chat_id: chatId,
    user_id: Number(telegramId),
    until_date: Math.floor(Date.now() / 1000) + 60,
    revoke_messages: false,
  });
  if (!ban.ok) return false;
  await callTelegram("unbanChatMember", { chat_id: chatId, user_id: Number(telegramId), only_if_banned: true });
  return true;
}

export async function onPremiumLost(userId: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { premiumUntil: true, role: true, telegramId: true },
  });
  if (!user || isActiveUntil(user.premiumUntil)) return;

  // Priority support is a Premium benefit; open tickets drop back to normal.
  await db.supportTicket.updateMany({
    where: { userId, priority: true, status: { not: "CLOSED" } },
    data: { priority: false },
  });

  if (isStaff(user.role) || !hasBotToken()) return;

  // Revoke every invite link we handed out that could still be used.
  const invites = await db.premiumChatInvite.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, inviteLink: true, chat: { select: { telegramChatId: true } } },
  });
  for (const inv of invites) {
    if (inv.chat.telegramChatId) {
      const res = await callTelegram("revokeChatInviteLink", { chat_id: inv.chat.telegramChatId, invite_link: inv.inviteLink });
      if (!res.ok) console.warn("[premium-lapse] invite revoke failed:", res.description);
    }
    await db.premiumChatInvite.update({ where: { id: inv.id }, data: { revokedAt: new Date() } });
  }

  // And take them out of the private groups they may already be in.
  if (user.telegramId) {
    const groups = await db.premiumChat.findMany({
      where: { kind: "TELEGRAM_GROUP", telegramChatId: { not: null } },
      select: { telegramChatId: true },
    });
    for (const g of groups) {
      if (!(await kickFromGroup(g.telegramChatId as string, user.telegramId))) {
        console.warn("[premium-lapse] could not remove an expired member from a group (is the bot an admin there?)");
      }
    }
  }
}

export async function onPremiumGained(userId: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { premiumUntil: true } });
  if (!user || !isActiveUntil(user.premiumUntil)) return;
  await db.supportTicket.updateMany({
    where: { userId, priority: false, status: { not: "CLOSED" } },
    data: { priority: true },
  });
}
