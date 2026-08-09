import "server-only";
import { db } from "@/lib/db";
import { sendMessage } from "./api";
import { markBotBlocked } from "./users";

/**
 * Broadcast delivery.
 *
 * Telegram's documented ceiling for bulk notifications is ~30 messages per
 * second, so sends are paced below that. Delivery state lives in
 * `broadcast_recipients` (one row per user, unique on (broadcast, user)) rather
 * than in memory, which is what makes a run resumable: a deploy cutover or a
 * crash mid-broadcast leaves rows PENDING, and the next run picks up exactly
 * those. Rows already marked SENT are never revisited, so a resume does not
 * re-message anyone who has already received it.
 */

/** Comfortably under the documented ~30/s bulk ceiling. */
const SEND_INTERVAL_MS = 50;
/** Bounded work per invocation so an HTTP-triggered run always returns. */
const MAX_RUN_MS = 20_000;
/** Give up on a recipient after this many transient failures. */
const MAX_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Materialises the recipient list. Blocked users are never enrolled. */
export async function queueBroadcast(broadcastId: string): Promise<number> {
  const users = await db.telegramUser.findMany({
    where: { blocked: false, botBlocked: false },
    select: { id: true },
  });
  if (users.length > 0) {
    await db.broadcastRecipient.createMany({
      data: users.map((u) => ({ broadcastId, userId: u.id })),
      skipDuplicates: true,
    });
  }
  await db.broadcast.update({
    where: { id: broadcastId },
    data: { status: "QUEUED", totalCount: users.length },
  });
  return users.length;
}

export interface RunSummary {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  remaining: number;
  status: string;
}

/**
 * Processes pending recipients for up to MAX_RUN_MS. Safe to call repeatedly
 * and safe to call concurrently — each recipient row is claimed with a
 * conditional update, so two overlapping runs cannot both send to the same
 * user.
 */
export async function runBroadcast(broadcastId: string): Promise<RunSummary> {
  const broadcast = await db.broadcast.findUnique({ where: { id: broadcastId } });
  if (!broadcast) return { processed: 0, sent: 0, failed: 0, skipped: 0, remaining: 0, status: "MISSING" };
  if (broadcast.status === "CANCELLED" || broadcast.status === "COMPLETED" || broadcast.status === "PAUSED") {
    return { processed: 0, sent: 0, failed: 0, skipped: 0, remaining: 0, status: broadcast.status };
  }

  await db.broadcast.update({
    where: { id: broadcastId },
    data: { status: "SENDING", startedAt: broadcast.startedAt ?? new Date() },
  });

  const deadline = Date.now() + MAX_RUN_MS;
  let sent = 0, failed = 0, skipped = 0, processed = 0;

  while (Date.now() < deadline) {
    // Re-read status so Cancel/Pause takes effect mid-run.
    const current = await db.broadcast.findUnique({
      where: { id: broadcastId },
      select: { status: true },
    });
    if (!current || current.status === "CANCELLED" || current.status === "PAUSED") break;

    const next = await db.broadcastRecipient.findFirst({
      where: { broadcastId, status: "PENDING", attempts: { lt: MAX_ATTEMPTS } },
      select: { id: true, attempts: true, user: { select: { telegramId: true } } },
      orderBy: { id: "asc" },
    });
    if (!next) break;

    // Claim it first: the attempt counter advances even if we die mid-send, so
    // a crash can retry at most MAX_ATTEMPTS times rather than loop forever.
    const claimed = await db.broadcastRecipient.updateMany({
      where: { id: next.id, status: "PENDING", attempts: next.attempts },
      data: { attempts: next.attempts + 1 },
    });
    if (claimed.count === 0) continue; // another run took it

    processed++;
    const res = await sendMessage(next.user.telegramId, broadcast.body);

    if (res.ok) {
      await db.broadcastRecipient.update({
        where: { id: next.id },
        data: { status: "SENT", sentAt: new Date(), error: null },
      });
      sent++;
    } else if (res.status === 403) {
      // User blocked the bot, or the account is deactivated: permanent.
      await db.broadcastRecipient.update({
        where: { id: next.id },
        data: { status: "SKIPPED", error: res.description.slice(0, 200) },
      });
      await markBotBlocked(next.user.telegramId);
      skipped++;
    } else if (res.status === 400) {
      // Chat not found / invalid recipient: permanent, do not retry.
      await db.broadcastRecipient.update({
        where: { id: next.id },
        data: { status: "FAILED", error: res.description.slice(0, 200) },
      });
      failed++;
    } else {
      // Transient (429/5xx/timeout): leave PENDING so a later run retries,
      // unless it has now exhausted its attempts.
      const exhausted = next.attempts + 1 >= MAX_ATTEMPTS;
      await db.broadcastRecipient.update({
        where: { id: next.id },
        data: {
          error: res.description.slice(0, 200),
          ...(exhausted ? { status: "FAILED" as const } : {}),
        },
      });
      if (exhausted) failed++;
      if (res.status === 429 && res.retryAfter) {
        // Honour Telegram's own back-off instruction.
        await sleep(Math.min(res.retryAfter * 1000, 10_000));
        continue;
      }
    }

    await sleep(SEND_INTERVAL_MS);
  }

  // Recompute counters from the rows themselves — cheap (indexed, grouped) and
  // immune to drift if a run is interrupted.
  const grouped = await db.broadcastRecipient.groupBy({
    by: ["status"],
    where: { broadcastId },
    _count: { _all: true },
  });
  const count = (s: string) => grouped.find((g) => g.status === s)?._count._all ?? 0;
  const remaining = count("PENDING");

  const after = await db.broadcast.findUnique({ where: { id: broadcastId }, select: { status: true } });
  const done = remaining === 0 && after?.status === "SENDING";
  await db.broadcast.update({
    where: { id: broadcastId },
    data: {
      sentCount: count("SENT"),
      failedCount: count("FAILED"),
      skippedCount: count("SKIPPED"),
      ...(done ? { status: "COMPLETED" as const, completedAt: new Date() } : {}),
    },
  });

  return { processed, sent, failed, skipped, remaining, status: done ? "COMPLETED" : (after?.status ?? "SENDING") };
}

/** Picks up any broadcast left mid-flight (e.g. by a deploy cutover). */
export async function resumePendingBroadcasts(): Promise<RunSummary[]> {
  const active = await db.broadcast.findMany({
    where: { status: { in: ["QUEUED", "SENDING"] } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 3,
  });
  const out: RunSummary[] = [];
  for (const b of active) out.push(await runBroadcast(b.id));
  return out;
}
