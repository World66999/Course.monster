/**
 * Next.js boot hook. Refuses to start without a complete Razorpay/support
 * configuration, then starts the in-process Premium scheduler (expiry +
 * reminders) on the Node runtime only. Set PREMIUM_JOBS=off to disable the
 * scheduler, e.g. when an external cron calls /api/premium/cron instead.
 * Also warms the Telegram bot's Bot API connections.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { assertPaymentEnv } = await import("@/lib/razorpay-config");
  // Throws with the list of missing/invalid variable names (never values).
  assertPaymentEnv();
  // Open the bot's Bot API connections before the first user taps anything.
  const { warmUp } = await import("@/lib/telegram/api");
  warmUp();
  if (process.env.PREMIUM_JOBS === "off") return;
  const { startPremiumScheduler } = await import("@/lib/premium-jobs");
  startPremiumScheduler();
}
