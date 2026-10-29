import "server-only";
import { PLANS, PLAN_KEYS, formatInr, inrPaise, type PlanKey } from "@/lib/premium-plans";

/**
 * Razorpay + support-contact configuration, read from the environment.
 *
 * Only RAZORPAY_KEY_ID is ever sent to a browser (Razorpay Checkout needs it).
 * The key secret and webhook secret stay on the server: they are read here on
 * use, never logged, never returned, never put in a URL. `server-only` makes a
 * client import a build error rather than a leak.
 *
 * `assertPaymentEnv()` runs at boot (src/instrumentation.ts), so a missing or
 * malformed variable stops the server with a clear message instead of failing
 * the first customer's checkout.
 */

export const REQUIRED_PAYMENT_ENV = [
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "RAZORPAY_USD_INR_RATE",
  "SUPPORT_TELEGRAM",
] as const;

const KEY_ID_RE = /^rzp_(test|live)_[A-Za-z0-9]{6,32}$/;
const TELEGRAM_HANDLE_RE = /^@?([A-Za-z][A-Za-z0-9_]{4,31})$/;

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

function parseRate(raw: string): number | null {
  if (!/^\d{1,5}(\.\d{1,4})?$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 && n <= 10_000 ? n : null;
}

/** Lists every problem at once, so one restart fixes them all. Never echoes a value. */
export function paymentEnvProblems(): string[] {
  const problems: string[] = [];
  for (const name of REQUIRED_PAYMENT_ENV) if (!env(name)) problems.push(`${name} is not set`);
  if (env("RAZORPAY_KEY_ID") && !KEY_ID_RE.test(env("RAZORPAY_KEY_ID"))) {
    problems.push("RAZORPAY_KEY_ID must look like rzp_live_... or rzp_test_...");
  }
  if (env("RAZORPAY_USD_INR_RATE") && parseRate(env("RAZORPAY_USD_INR_RATE")) === null) {
    problems.push("RAZORPAY_USD_INR_RATE must be a positive number, e.g. 100");
  }
  if (env("SUPPORT_TELEGRAM") && !TELEGRAM_HANDLE_RE.test(env("SUPPORT_TELEGRAM"))) {
    problems.push("SUPPORT_TELEGRAM must be a Telegram username, e.g. @YourSupport");
  }
  return problems;
}

export function assertPaymentEnv(): void {
  const problems = paymentEnvProblems();
  if (problems.length > 0) {
    throw new Error(`Payment configuration is incomplete — fix .env and restart:\n  - ${problems.join("\n  - ")}`);
  }
}

function required(name: (typeof REQUIRED_PAYMENT_ENV)[number]): string {
  const v = env(name);
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

/** Public key id — the one value that may go to the browser. */
export function razorpayKeyId(): string {
  return required("RAZORPAY_KEY_ID");
}

export function razorpayKeySecret(): string {
  return required("RAZORPAY_KEY_SECRET");
}

export function razorpayWebhookSecret(): string {
  return required("RAZORPAY_WEBHOOK_SECRET");
}

export function usdInrRate(): number {
  const rate = parseRate(required("RAZORPAY_USD_INR_RATE"));
  if (rate === null) throw new Error("RAZORPAY_USD_INR_RATE is invalid");
  return rate;
}

export function isRazorpayConfigured(): boolean {
  return paymentEnvProblems().length === 0;
}

export interface SupportContact {
  /** "@Handle" */
  handle: string;
  url: string;
}

/**
 * The only contact shown to customers anywhere (site, bot, checkout). Falls
 * back to null rather than throwing so a page render never crashes on it; the
 * boot check already refuses to start without a valid value.
 */
export function supportTelegram(): SupportContact | null {
  const m = TELEGRAM_HANDLE_RE.exec(env("SUPPORT_TELEGRAM"));
  if (!m) return null;
  return { handle: `@${m[1]}`, url: `https://t.me/${m[1]}` };
}

/**
 * INR price of every plan, or null when Razorpay isn't configured. For page
 * renders (which must not crash on config); charging always goes through
 * planPrice() in razorpay-payments.ts, which throws instead.
 */
export function inrPricesSafe(): Record<PlanKey, { paise: number; label: string }> | null {
  if (!isRazorpayConfigured()) return null;
  const rate = usdInrRate();
  const out = {} as Record<PlanKey, { paise: number; label: string }>;
  for (const key of PLAN_KEYS) {
    const paise = inrPaise(PLANS[key].priceUsd, rate);
    out[key] = { paise, label: formatInr(paise) };
  }
  return out;
}
