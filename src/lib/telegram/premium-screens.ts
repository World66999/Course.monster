import "server-only";
import type { InlineKeyboard } from "./api";
import { esc } from "./render";
import { PLANS } from "@/lib/premium-plans";
import { isActiveUntil } from "@/lib/premium";

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

export function premiumScreen(site: string): Screen {
  const m = PLANS.MONTHLY;
  const y = PLANS.YEARLY;
  return {
    text:
      "👑 <b>Courses Monster Premium</b>\n\n" +
      "• Instant downloads — no timers, steps or ads\n" +
      "• Premium courses and Premium Resources\n" +
      "• Members-only chats\n" +
      "• Priority support\n\n" +
      `<b>${m.name}</b> — $${m.priceUsd} / ${m.periodLabel}\n` +
      `<b>${y.name}</b> — $${y.priceUsd} / ${y.periodLabel}  (${esc(y.badge ?? "")})\n\n` +
      "Payment is in crypto through NOWPayments. Tap a plan to continue on the website.",
    keyboard: [
      [{ text: `${y.name} — $${y.priceUsd} · Best value`, url: `${site}/premium/checkout?plan=YEARLY`, style: "success" }],
      [{ text: `${m.name} — $${m.priceUsd}`, url: `${site}/premium/checkout?plan=MONTHLY` }],
      [{ text: "See everything Premium includes", url: `${site}/premium` }],
    ],
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
  return {
    text: `Account: ${esc(linked.name)}\nPlan: <b>Free</b>\n\nUpgrade with /premium.`,
    keyboard: [[{ text: "Get Premium", url: `${site}/premium` }]],
  };
}
