"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserSafe } from "@/server/auth-helpers";
import { createCheckout } from "@/lib/payments";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/ip";
import { createLinkToken, LINK_PREFIX } from "@/lib/telegram-link";
import { botUsername } from "@/lib/telegram/config";
import { callTelegram } from "@/lib/telegram/api";
import { isActiveUntil } from "@/lib/premium";
import { isStaff } from "@/lib/roles";
import { cleanText } from "@/lib/sanitize";

/**
 * Member-facing Premium actions. Server actions get Next.js's built-in CSRF
 * defence (the Origin header must match the host), and every one re-reads the
 * caller's account from the database before doing anything.
 */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; code?: string };

function limited(key: string, limit: number, windowMs: number): boolean {
  return !checkRateLimit(key, { limit, windowMs }).ok;
}

export async function createCheckoutAction(plan: unknown, coin: unknown): Promise<Result<{ invoiceUrl: string }>> {
  const auth = await requireUserSafe();
  if (!auth.ok) return { ok: false, error: auth.error, code: "auth" };
  const ipKey = hashIp(await getClientIp());
  if (limited(`checkout:${auth.user.id}`, 5, 10 * 60_000) || limited(`checkout-ip:${ipKey}`, 15, 10 * 60_000)) {
    return { ok: false, error: "Too many checkout attempts. Please wait a few minutes." };
  }
  const result = await createCheckout({ userId: auth.user.id, plan, coin });
  if (!result.ok) return result;
  return { ok: true, invoiceUrl: result.invoiceUrl };
}

export async function createTelegramLinkAction(): Promise<Result<{ url: string }>> {
  const auth = await requireUserSafe();
  if (!auth.ok) return { ok: false, error: auth.error, code: "auth" };
  const bot = botUsername();
  if (!bot) return { ok: false, error: "Telegram linking is not configured." };
  if (limited(`tg-link:${auth.user.id}`, 5, 60 * 60_000)) {
    return { ok: false, error: "Too many link attempts. Try again later." };
  }
  const token = await createLinkToken(auth.user.id);
  if (!token) return { ok: false, error: "Too many link attempts. Try again later." };
  return { ok: true, url: `https://t.me/${encodeURIComponent(bot)}?start=${LINK_PREFIX}${token}` };
}

export async function unlinkTelegramAction(): Promise<Result> {
  const auth = await requireUserSafe();
  if (!auth.ok) return { ok: false, error: auth.error, code: "auth" };
  await db.user.update({ where: { id: auth.user.id }, data: { telegramId: null } });
  return { ok: true };
}

const chatMessageSchema = z.object({ chatId: z.string().cuid(), body: z.string().min(1).max(4000) });
const PREMIUM_CHAT_MAX = 1000;

export async function sendPremiumChatMessageAction(input: unknown): Promise<Result<{ id: string }>> {
  const auth = await requireUserSafe();
  if (!auth.ok) return { ok: false, error: auth.error, code: "auth" };
  const parsed = chatMessageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid message." };
  const body = cleanText(parsed.data.body, PREMIUM_CHAT_MAX);
  if (!body) return { ok: false, error: "Message can't be empty." };

  const me = await db.user.findUnique({
    where: { id: auth.user.id },
    select: { premiumUntil: true, role: true, premiumChatBanned: true, premiumChatMutedUntil: true },
  });
  if (!me || !(isActiveUntil(me.premiumUntil) || isStaff(me.role))) {
    return { ok: false, error: "Members' chats are part of Premium.", code: "premium" };
  }
  if (me.premiumChatBanned) return { ok: false, error: "You can't post in members' chats." };
  if (me.premiumChatMutedUntil && me.premiumChatMutedUntil.getTime() > Date.now()) {
    return { ok: false, error: "You're muted for now. Try again later." };
  }
  if (limited(`pchat:${auth.user.id}`, 20, 60_000)) {
    return { ok: false, error: "You're sending messages too fast." };
  }
  const chat = await db.premiumChat.findFirst({
    where: { id: parsed.data.chatId, published: true, kind: "WEB_ROOM" },
    select: { id: true },
  });
  if (!chat) return { ok: false, error: "Chat not found." };
  const row = await db.premiumChatMessage.create({ data: { chatId: chat.id, userId: auth.user.id, body } });
  return { ok: true, id: row.id };
}

/**
 * Mints a one-time invite to a private Telegram group: one member, valid for
 * 15 minutes. A forwarded link is useless once its single seat is taken.
 */
export async function getPremiumChatInviteAction(chatId: unknown): Promise<Result<{ url: string }>> {
  const auth = await requireUserSafe();
  if (!auth.ok) return { ok: false, error: auth.error, code: "auth" };
  if (!z.string().cuid().safeParse(chatId).success) return { ok: false, error: "Invalid request." };
  const me = await db.user.findUnique({
    where: { id: auth.user.id },
    select: { premiumUntil: true, role: true, premiumChatBanned: true },
  });
  if (!me || !(isActiveUntil(me.premiumUntil) || isStaff(me.role))) {
    return { ok: false, error: "Members' chats are part of Premium.", code: "premium" };
  }
  if (me.premiumChatBanned) return { ok: false, error: "You can't join members' chats." };
  if (limited(`pchat-invite:${auth.user.id}`, 5, 60 * 60_000)) {
    return { ok: false, error: "Too many invite requests. Try again later." };
  }
  const chat = await db.premiumChat.findFirst({
    where: { id: chatId as string, published: true, kind: "TELEGRAM_GROUP" },
    select: { telegramChatId: true },
  });
  if (!chat?.telegramChatId) return { ok: false, error: "This group is not available right now." };
  const res = await callTelegram<{ invite_link: string }>("createChatInviteLink", {
    chat_id: chat.telegramChatId,
    member_limit: 1,
    expire_date: Math.floor(Date.now() / 1000) + 15 * 60,
    name: `cv-${auth.user.id.slice(-8)}`,
  });
  if (!res.ok) {
    console.error("[premium-chat] invite link failed:", res.description);
    return { ok: false, error: "Couldn't create an invite right now. Please try again shortly." };
  }
  return { ok: true, url: res.result.invite_link };
}
