import "server-only";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/telegram/config";
import { notifyUser } from "@/lib/telegram/notify";
import { onPremiumLost } from "@/lib/premium-lapse";
import { PLANS } from "@/lib/premium-plans";

/**
 * Scheduled Premium housekeeping: mark lapsed periods EXPIRED, clean up what
 * lives outside a request (Telegram groups, invites, support priority), tell
 * the user it expired, and send the 3-day / 1-day reminders.
 *
 * Access never depends on this job — every premium check compares
 * premiumUntil with the clock at request time, so a late or missed run only
 * delays bookkeeping and messages, never locks or unlocks anything.
 *
 * Safe to run concurrently (both deploy slots briefly overlap): reminders are
 * claimed with one conditional UPDATE ... RETURNING, so a reminder for a given
 * expiry date is sent at most once no matter how many runners race.
 */

interface Claimed {
  id: string;
  premiumUntil: Date;
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function runPremiumJobs(now = new Date()): Promise<{ expired: number; reminded3d: number; reminded1d: number }> {
  // 1. Expire lapsed periods, and tell users whose *last* period just ended.
  const lapsed = await db.subscription.findMany({
    where: { status: "ACTIVE", expiresAt: { lte: now } },
    select: { id: true, userId: true, expiresAt: true },
    take: 500,
  });
  let expired = 0;
  for (const sub of lapsed) {
    const { count } = await db.subscription.updateMany({
      where: { id: sub.id, status: "ACTIVE" },
      data: { status: "EXPIRED" },
    });
    if (count !== 1) continue;
    expired++;
    const user = await db.user.findUnique({ where: { id: sub.userId }, select: { premiumUntil: true } });
    // Only the end of the chain is a real expiry; a stacked renewal follows on.
    if (user?.premiumUntil && user.premiumUntil.getTime() <= now.getTime() && user.premiumUntil.getTime() <= sub.expiresAt.getTime()) {
      // Website access already stopped at premiumUntil; this removes the
      // things outside a request (group membership, invite links, priority).
      await onPremiumLost(sub.userId).catch((err) =>
        console.error("[premium-jobs] lapse clean-up failed:", err instanceof Error ? err.message : err)
      );
      await notifyUser(
        sub.userId,
        "⌛ <b>Your Premium has expired – renew to keep access</b>\n\n" +
          "Instant downloads, premium courses, Premium Resources and members' chats are paused. " +
          "Renew any time and everything comes straight back.",
        [
          [{ text: "👑 Renew Premium", url: `${siteUrl()}/premium#plans` }],
          [{ text: `${PLANS.YEARLY.name} — $${PLANS.YEARLY.priceUsd} · Best value`, url: `${siteUrl()}/premium/checkout?plan=YEARLY` }],
        ]
      );
    }
  }

  // 2. Reminders. Prisma stores DateTime as UTC in `timestamp without time
  // zone`, so "now" is converted to naive UTC explicitly — a bare cast would
  // follow the DB session's TimeZone setting and shift the windows.
  const nowUtc = now.toISOString();
  // Window boundaries are exclusive of each other, so a user
  // who is already inside the 1-day window never also gets the 3-day one.
  const remind3 = await db.$queryRaw<Claimed[]>`
    UPDATE "users" SET "premiumReminder3dFor" = "premiumUntil"
    WHERE "premiumUntil" > (${nowUtc}::timestamptz AT TIME ZONE 'UTC') + interval '1 day'
      AND "premiumUntil" <= (${nowUtc}::timestamptz AT TIME ZONE 'UTC') + interval '3 days'
      AND "telegramId" IS NOT NULL AND "disabled" = false
      AND "premiumReminder3dFor" IS DISTINCT FROM "premiumUntil"
    RETURNING "id", "premiumUntil"`;
  const remind1 = await db.$queryRaw<Claimed[]>`
    UPDATE "users" SET "premiumReminder1dFor" = "premiumUntil"
    WHERE "premiumUntil" > (${nowUtc}::timestamptz AT TIME ZONE 'UTC')
      AND "premiumUntil" <= (${nowUtc}::timestamptz AT TIME ZONE 'UTC') + interval '1 day'
      AND "telegramId" IS NOT NULL AND "disabled" = false
      AND "premiumReminder1dFor" IS DISTINCT FROM "premiumUntil"
    RETURNING "id", "premiumUntil"`;

  const renewLink = `<a href="${siteUrl()}/premium">Renew now</a>`;
  for (const u of remind3) {
    await notifyUser(
      u.id,
      `🔔 <b>Premium reminder</b>\n\nYour Premium ends in about 3 days (${fmt(u.premiumUntil)}). ` +
        `Renewing early is safe — the new time is added on top of what you have left. ${renewLink}`
    );
  }
  for (const u of remind1) {
    await notifyUser(
      u.id,
      `⏰ <b>Premium ends tomorrow</b>\n\nYour Premium ends on ${fmt(u.premiumUntil)}. ` +
        `Renew to keep instant downloads, premium courses and members' chats. ${renewLink}`
    );
  }

  return { expired, reminded3d: remind3.length, reminded1d: remind1.length };
}

let started = false;

/** In-process scheduler, started once from instrumentation.ts. */
export function startPremiumScheduler(): void {
  if (started) return;
  started = true;
  const INTERVAL_MS = 15 * 60 * 1000;
  const tick = () => {
    runPremiumJobs()
      .then((r) => {
        if (r.expired || r.reminded3d || r.reminded1d) console.info("[premium-jobs]", r);
      })
      .catch((err) => console.error("[premium-jobs] run failed:", err instanceof Error ? err.message : err));
  };
  // First run shortly after boot, then every 15 minutes. unref() so the timer
  // never keeps a shutting-down process alive.
  setTimeout(tick, 60_000).unref();
  setInterval(tick, INTERVAL_MS).unref();
}
