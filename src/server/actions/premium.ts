"use server";

import { z } from "@/lib/zod";
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
import { confirmWebCheckout, createWebOrder, type ConfirmResult, type WebOrderResult } from "@/lib/razorpay-payments";
import { isRazorpayConfigured } from "@/lib/razorpay-config";
import { isSameOrigin } from "@/server/same-origin";

/**
 * Member-facing Premium actions. Server actions get Next.js's built-in CSRF
 * defence (the Origin header must match the host), and every one re-reads the
 * caller's account from the database before doing anything.
 */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; code?: string };

function limited(key: string, limit: number, windowMs: number): boolean {
  return !checkRateLimit(key, { limit, windowMs }).ok;
}

export async function createCheckoutAction(
  plan: unknown,
  coin: unknown,
  returnPath?: unknown
): Promise<Result<{ invoiceUrl: string }>> {
  const auth = await requireUserSafe();
  if (!auth.ok) return { ok: false, error: auth.error, code: "auth" };
  const ipKey = hashIp(await getClientIp());
  if (limited(`checkout:${auth.user.id}`, 5, 10 * 60_000) || limited(`checkout-ip:${ipKey}`, 15, 10 * 60_000)) {
    return { ok: false, error: "Too many checkout attempts. Please wait a few minutes." };
  }
  const result = await createCheckout({ userId: auth.user.id, plan, coin, returnPath });
  if (!result.ok) return result;
  return { ok: true, invoiceUrl: result.invoiceUrl };
}

const razorpayOrderSchema = z.object({
  plan: z.enum(["MONTHLY", "YEARLY"]),
  // The Terms / No Refund Policy checkbox must be ticked; enforced here too.
  agreed: z.literal(true),
});

/**
 * Starts a Razorpay checkout. Only the plan key comes from the browser: the
 * amount and currency are computed on the server from the plan, and the order
 * is bound to the signed-in account.
 */
export async function createRazorpayOrderAction(input: unknown): Promise<WebOrderResult | { ok: false; error: string; code?: string }> {
  if (!(await isSameOrigin())) return { ok: false, error: "Please reload the page and try again." };
  const auth = await requireUserSafe();
  if (!auth.ok) return { ok: false, error: auth.error, code: "auth" };
  const parsed = razorpayOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please choose a plan and accept the Terms and the No Refund Policy." };
  }
  if (!isRazorpayConfigured()) return { ok: false, error: "UPI / card payments are temporarily unavailable." };
  try {
    return await createWebOrder(auth.user.id, parsed.data.plan, hashIp(await getClientIp()));
  } catch (err) {
    console.error("[razorpay] order action failed:", err instanceof Error ? err.message : "unknown");
    return { ok: false, error: "We couldn't start the payment just now. Please try again in a moment." };
  }
}

const razorpayConfirmSchema = z.object({
  orderId: z.string().regex(/^order_[A-Za-z0-9]{6,40}$/),
  paymentId: z.string().regex(/^pay_[A-Za-z0-9]{6,40}$/),
  signature: z.string().regex(/^[0-9a-f]{64}$/i),
});

/**
 * Called by Razorpay Checkout's success handler. The browser's word is only a
 * pointer: the signature is verified, then the payment is fetched from
 * Razorpay and checked against our order before Premium is granted.
 */
export async function confirmRazorpayPaymentAction(input: unknown): Promise<ConfirmResult | { ok: false; error: string; code?: string }> {
  if (!(await isSameOrigin())) return { ok: false, error: "Please reload the page and try again." };
  const auth = await requireUserSafe();
  if (!auth.ok) return { ok: false, error: auth.error, code: "auth" };
  const parsed = razorpayConfirmSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "We couldn't verify this payment." };
  if (limited(`rzp-confirm:${auth.user.id}`, 20, 10 * 60_000)) {
    return { ok: false, error: "Too many attempts. Please wait a few minutes — if you paid, Premium activates automatically." };
  }
  try {
    return await confirmWebCheckout(auth.user.id, parsed.data);
  } catch (err) {
    console.error("[razorpay] confirm action failed:", err instanceof Error ? err.message : "unknown");
    // A transient fault (Razorpay API, database). The webhook will still settle it.
    return { ok: true, state: "pending" };
  }
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
  const expiresAt = new Date(Date.now() + 15 * 60_000);
  const res = await callTelegram<{ invite_link: string }>("createChatInviteLink", {
    chat_id: chat.telegramChatId,
    member_limit: 1,
    expire_date: Math.floor(expiresAt.getTime() / 1000),
    name: `cv-${auth.user.id.slice(-8)}`,
  });
  if (!res.ok) {
    console.error("[premium-chat] invite link failed:", res.description);
    return { ok: false, error: "Couldn't create an invite right now. Please try again shortly." };
  }
  // Tracked so a lapse or revoke can kill links that haven't been used yet.
  await db.premiumChatInvite.create({
    data: { chatId: chatId as string, userId: auth.user.id, inviteLink: res.result.invite_link, expiresAt },
  });
  return { ok: true, url: res.result.invite_link };
}
