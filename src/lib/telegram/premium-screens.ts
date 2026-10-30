import "server-only";
import type { InlineKeyboard } from "./api";
import { esc } from "./render";
import { NO_REFUND_NOTICE, PLANS, type PlanKey } from "@/lib/premium-plans";
import { isActiveUntil } from "@/lib/premium";
import { PREMIUM_BENEFIT_LINES } from "@/lib/premium-welcome";

/**
 * Bot screens for Premium. Kept beside, not inside, the branded catalog
 * screens: these are transactional messages whose wording must match the
 * website's plan copy exactly, so they are not admin-relabelable.
 */

interface Screen {
  text: string;
  keyboard: InlineKeyboard;
}

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export interface PayOptions {
  /** INR labels per plan; null hides the UPI / card buttons. */
  inr: Record<PlanKey, { label: string }> | null;
  support: { handle: string; url: string } | null;
}

/** Callback data for the Razorpay buttons. Carries only the plan key. */
export const RZP_CALLBACK = { MONTHLY: "rz:m", YEARLY: "rz:y", back: "rz:back" } as const;

export function parseRzpCallback(data: string | undefined): PlanKey | "back" | null {
  if (data === RZP_CALLBACK.MONTHLY) return "MONTHLY";
  if (data === RZP_CALLBACK.YEARLY) return "YEARLY";
  if (data === RZP_CALLBACK.back) return "back";
  return null;
}

function price(plan: PlanKey, inr: PayOptions["inr"]): string {
  const p = PLANS[plan];
  return `$${p.priceUsd}${inr ? ` (${inr[plan].label})` : ""}`;
}

function supportLine(support: PayOptions["support"]): string {
  return support ? `\nSupport: ${esc(support.handle)}` : "";
}

export function premiumScreen(site: string, opts: PayOptions = { inr: null, support: null }): Screen {
  const m = PLANS.MONTHLY;
  const y = PLANS.YEARLY;
  const { inr, support } = opts;
  // Best value first; one row per payment method so the buttons stay short.
  const keyboard: InlineKeyboard = [];
  if (inr) {
    keyboard.push([
      { text: `💳 ${y.name} · ${inr.YEARLY.label}`, callback_data: RZP_CALLBACK.YEARLY, style: "success" },
      { text: `💳 ${m.name} · ${inr.MONTHLY.label}`, callback_data: RZP_CALLBACK.MONTHLY },
    ]);
  }
  keyboard.push([
    { text: `🪙 ${y.name} · $${y.priceUsd}`, url: `${site}/premium/checkout?plan=YEARLY&method=crypto` },
    { text: `🪙 ${m.name} · $${m.priceUsd}`, url: `${site}/premium/checkout?plan=MONTHLY&method=crypto` },
  ]);
  keyboard.push([{ text: "✨ See everything Premium includes", url: `${site}/premium` }]);
  return {
    text:
      "👑 <b>Courses Monster Premium</b>\n" +
      "<i>Learn without the wait.</i>\n\n" +
      PREMIUM_BENEFIT_LINES.join("\n") +
      "\n\n" +
      `🏆 <b>${y.name}</b> — ${price("YEARLY", inr)} / ${y.periodLabel} · ${esc(y.badge ?? "")}\n` +
      `📅 <b>${m.name}</b> — ${price("MONTHLY", inr)} / ${m.periodLabel}\n\n` +
      (inr
        ? "💳 = UPI, card or netbanking (Razorpay, in INR)\n🪙 = crypto (NOWPayments, on the website)\nOne-off payments — nothing renews by itself.\n\n"
        : "Payment is in crypto through NOWPayments. Tap a plan to continue on the website.\n\n") +
      `⚠️ <b>${esc(NO_REFUND_NOTICE)}</b>` +
      supportLine(support),
    keyboard,
  };
}

const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false });

/** Shown with a fresh (or reused) Razorpay Payment Link. */
export function razorpayLinkScreen(
  site: string,
  link: { url: string; plan: PlanKey; amountLabel: string; expiresAt: Date },
  support: PayOptions["support"]
): Screen {
  const p = PLANS[link.plan];
  const minutes = Math.max(1, Math.round((link.expiresAt.getTime() - Date.now()) / 60_000));
  return {
    text:
      "💳 <b>Pay with UPI / Card</b>\n\n" +
      `Plan: <b>Premium ${esc(p.name)}</b> (1 ${p.periodLabel})\n` +
      `Price: <b>${esc(link.amountLabel)}</b> ($${p.priceUsd})\n` +
      `Link valid for: <b>${minutes} min</b> (until ${TIME.format(link.expiresAt)} UTC)\n\n` +
      "Tap the button below to pay securely on Razorpay with UPI, card or netbanking. " +
      "Premium activates automatically once the payment is confirmed — we'll message you here.\n\n" +
      `⚠️ <b>${esc(NO_REFUND_NOTICE)}</b>\nBy paying you agree to our Terms and No Refund Policy.` +
      supportLine(support),
    keyboard: [
      [{ text: `Pay ${link.amountLabel} securely`, url: link.url, style: "success" }],
      [
        { text: "Terms", url: `${site}/terms` },
        { text: "No Refund Policy", url: `${site}/refund-policy` },
      ],
      [{ text: "« Back to plans", callback_data: RZP_CALLBACK.back }],
    ],
  };
}

/** Shown while the payment link is being created, so the tap feels answered. */
export function razorpayPreparingScreen(): Screen {
  return { text: "⏳ <b>Preparing your secure payment link…</b>\n\nThis only takes a moment.", keyboard: [] };
}

export function razorpayNeedsLinkScreen(site: string): Screen {
  return {
    text:
      "🔗 <b>Link your account first</b>\n\n" +
      "Premium belongs to your website account, so it works on the site and here. " +
      "Sign in on the website, open <b>Account → Telegram</b> and tap <b>Connect Telegram</b> — then come back and tap the plan again.",
    keyboard: [
      [{ text: "Open my account", url: `${site}/account#telegram` }],
      [{ text: "« Back to plans", callback_data: RZP_CALLBACK.back }],
    ],
  };
}

export function razorpayErrorScreen(message: string, support: PayOptions["support"]): Screen {
  return {
    text: `⚠️ ${esc(message)}` + (support ? `\n\nIf this keeps happening, message ${esc(support.handle)}.` : ""),
    keyboard: [[{ text: "« Back to plans", callback_data: RZP_CALLBACK.back }]],
  };
}

export function statusScreen(
  site: string,
  linked: { name: string; premiumUntil: Date | null; plan: string | null } | null
): Screen {
  if (!linked) {
    return {
      text:
        "🔗 <b>Your Telegram isn't linked yet</b>\n\n" +
        "Sign in on the website, open <b>Account → Telegram</b> and tap <b>Connect Telegram</b>. " +
        "Then /mystatus will show your plan here, and we'll message you about payments and replies.",
      keyboard: [[{ text: "Open my account", url: `${site}/account#telegram` }]],
    };
  }
  if (isActiveUntil(linked.premiumUntil)) {
    const plan = linked.plan ? (PLANS[linked.plan as keyof typeof PLANS]?.name ?? linked.plan) : "Premium";
    return {
      text:
        `👑 <b>Premium is active</b>\n\nAccount: ${esc(linked.name)}\nPlan: <b>${esc(plan)}</b>\n` +
        `Expires: <b>${DATE.format(linked.premiumUntil as Date)}</b>\n\nRenewing adds time on top of your current expiry.`,
      keyboard: [[{ text: "Renew", url: `${site}/premium` }]],
    };
  }
  if (linked.premiumUntil) {
    const y = PLANS.YEARLY;
    return {
      text:
        `⌛ <b>Premium: Expired</b>\n\nAccount: ${esc(linked.name)}\nExpired on: <b>${DATE.format(linked.premiumUntil)}</b>\n\n` +
        "Your Premium has expired – renew to keep access.",
      keyboard: [
        [{ text: "👑 Renew Premium", url: `${site}/premium#plans`, style: "success" }],
        [{ text: `${y.name} — $${y.priceUsd} · Best value`, url: `${site}/premium/checkout?plan=YEARLY` }],
      ],
    };
  }
  return {
    text: `Account: ${esc(linked.name)}\nPlan: <b>Free</b>\n\nUpgrade with /premium.`,
    keyboard: [[{ text: "Get Premium", url: `${site}/premium` }]],
  };
}
