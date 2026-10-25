/**
 * Next.js boot hook. Starts the in-process Premium scheduler (expiry +
 * reminders) on the Node runtime only. Set PREMIUM_JOBS=off to disable it,
 * e.g. when an external cron calls /api/premium/cron instead.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.PREMIUM_JOBS === "off") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { startPremiumScheduler } = await import("@/lib/premium-jobs");
  startPremiumScheduler();
}
