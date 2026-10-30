import "server-only";
import type { InlineKeyboard } from "@/lib/telegram/api";

/**
 * The Telegram message a buyer gets the moment Premium switches on, for both
 * Razorpay and NOWPayments. Facts only: the plan, what was paid, until when,
 * and what is now unlocked.
 */

/** Short benefit lines shared by the bot's Premium menu and the welcome message. */
export const PREMIUM_BENEFIT_LINES = [
  "⚡ Instant downloads — no timers, steps or ads",
  "🎓 Premium courses and Premium Resources",
  "🔒 Private Telegram groups for members",
  "🛟 Priority support",
] as const;

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function premiumWelcomeMessage(opts: {
  site: string;
  planName: string;
  amountLabel: string;
  expiresAt: Date;
  paymentId?: string | null;
  supportHandle?: string | null;
  /** Page to pick up from (a "Skip ads" origin), already validated. */
  returnPath?: string | null;
}): { text: string; keyboard: InlineKeyboard } {
  const lines = [
    "🎉 <b>Welcome to Premium!</b>",
    "Your payment went through and Premium is now active on your account.",
    "",
    `👑 Plan: <b>${esc(opts.planName)}</b>`,
    `💳 Paid: <b>${esc(opts.amountLabel)}</b>`,
    `📅 Active until: <b>${DATE.format(opts.expiresAt)}</b>`,
    ...(opts.paymentId ? [`🧾 Payment ID: <code>${esc(opts.paymentId)}</code>`] : []),
    "",
    "<b>Unlocked for you</b>",
    ...PREMIUM_BENEFIT_LINES,
    ...(opts.supportHandle ? ["", `Need help? Message ${esc(opts.supportHandle)} on Telegram.`] : []),
  ];
  const keyboard: InlineKeyboard = [];
  if (opts.returnPath) keyboard.push([{ text: "⚡ Continue — direct link", url: `${opts.site}${opts.returnPath}` }]);
  keyboard.push([
    { text: "👑 Premium Resources", url: `${opts.site}/premium-resources` },
    { text: "🔒 Private groups", url: `${opts.site}/premium-chats` },
  ]);
  return { text: lines.join("\n"), keyboard };
}
