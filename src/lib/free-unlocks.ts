import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getSiteSettings } from "@/lib/settings";
import { verifyAttributionToken } from "@/lib/telegram/attribution";
import { findLinkedUser } from "@/lib/telegram-link";
import { shortenWith } from "@/lib/shortener";
import {
  effectiveDailyLimit,
  fallbackChain,
  istDay,
  nextIstMidnight,
  providerForSlot,
  usedToday,
  type ShortenerProvider,
} from "@/lib/shortener-core";

/**
 * Free users: at most N course unlocks per Asia/Kolkata day, each one earned
 * by completing a URL shortener. The n-th unlock of the day uses
 * providerForSlot(n): VPLink, GPLinks, LinkShortify.
 *
 * Flow:
 *   1. /api/download/init (after countdown + captcha + human check) calls
 *      startUnlock(): a one-time token is minted and stored hashed, bound to
 *      the subject, the course, this browser (cookie) and an expiry; the
 *      return URL /unlock/<token> is shortened with the due shortener.
 *   2. The visitor completes the shortener and is sent to /unlock/<token>.
 *   3. completeUnlock() verifies the token (exists, not used, not expired,
 *      same browser, not suspiciously fast) and, in one transaction, records
 *      the unlock and bumps today's count — or refuses if the limit was hit.
 * Opening the short link without finishing it never reaches step 3, so it
 * never counts.
 */

export const UNLOCK_TTL_MS = 60 * 60 * 1000;
/** Real shorteners take well over this; an instant return means a bypass. */
export const MIN_COMPLETION_MS = 10_000;
/** A pending attempt is reused (same short link) instead of minting a new one. */
const REUSE_WINDOW_MS = 30 * 60 * 1000;
export const BROWSER_COOKIE = "cv_ub";

export type FreeSubject = {
  key: string;
  kind: "user" | "telegram" | "ip";
  userId: string | null;
  telegramUserId: string | null;
};

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function newBrowserId(): string {
  return randomBytes(24).toString("base64url");
}

export function ipSubject(ipHash: string): FreeSubject {
  return { key: `ip:${ipHash}`, kind: "ip", userId: null, telegramUserId: null };
}

export function userSubject(userId: string, telegramUserId: string | null = null): FreeSubject {
  return { key: `u:${userId}`, kind: "user", userId, telegramUserId };
}

/** A bot user: their linked site account if any, else the Telegram id itself. */
export async function telegramSubject(telegramUserId: string): Promise<FreeSubject> {
  const linked = await findLinkedUser(telegramUserId);
  if (linked) return userSubject(linked.id, telegramUserId);
  return { key: `tg:${telegramUserId}`, kind: "telegram", userId: null, telegramUserId };
}

/**
 * Who a website request counts against: the Telegram user who was handed this
 * page by the bot (signed, course-bound attribution), else the signed-in
 * account, else the visitor's IP.
 */
export async function resolveWebSubject(args: {
  attribution: string;
  courseId: string;
  viewerId: string | null;
  ipHash: string;
}): Promise<FreeSubject> {
  const tg = args.attribution ? verifyAttributionToken(args.attribution, args.courseId) : null;
  if (tg) return telegramSubject(tg);
  if (args.viewerId) return userSubject(args.viewerId);
  return ipSubject(args.ipHash);
}

export interface FreeConfig {
  limit: number;
  gplinks: boolean;
  linkshortify: boolean;
}

export async function getFreeConfig(): Promise<FreeConfig> {
  const s = (await getSiteSettings()).freeUnlocks;
  return {
    limit: effectiveDailyLimit(s?.dailyLimit ?? null, process.env.FREE_DAILY_COURSE_LIMIT),
    gplinks: s?.gplinksEnabled ?? true,
    linkshortify: s?.linkshortifyEnabled ?? true,
  };
}

export interface FreeStatus {
  used: number;
  limit: number;
  /** This course was already unlocked by this subject (re-opening is free). */
  unlocked: boolean;
  limitReached: boolean;
  /** Shortener the next unlock will use (before fallback). */
  nextProvider: ShortenerProvider;
  resetsAt: Date;
}

export async function getFreeStatus(subject: FreeSubject, courseId: string | null, now = new Date()): Promise<FreeStatus> {
  const today = istDay(now);
  const [config, quota, unlock] = await Promise.all([
    getFreeConfig(),
    db.freeUnlockQuota.findUnique({ where: { subjectKey: subject.key }, select: { day: true, count: true } }),
    courseId
      ? db.freeUnlock.findUnique({
          where: { subjectKey_courseId: { subjectKey: subject.key, courseId } },
          select: { id: true },
        })
      : null,
  ]);
  const used = usedToday(quota, today);
  return {
    used,
    limit: config.limit,
    unlocked: Boolean(unlock),
    limitReached: used >= config.limit,
    nextProvider: providerForSlot(used + 1),
    resetsAt: nextIstMidnight(now),
  };
}

export async function hasUnlocked(subjectKey: string, courseId: string): Promise<boolean> {
  const row = await db.freeUnlock.findUnique({
    where: { subjectKey_courseId: { subjectKey, courseId } },
    select: { id: true },
  });
  return Boolean(row);
}

export type StartResult =
  | { ok: true; sessionId: string }
  | { ok: false; reason: "limit"; status: FreeStatus };

/**
 * Creates (or reuses) a pending unlock attempt and its short link. Does not
 * count anything — only completeUnlock() does.
 */
export async function startUnlock(args: {
  subject: FreeSubject;
  course: { id: string; slug: string };
  browserId: string;
  ipHash: string;
  origin: string;
  now?: Date;
}): Promise<StartResult> {
  const now = args.now ?? new Date();
  const status = await getFreeStatus(args.subject, args.course.id, now);
  if (status.limitReached) return { ok: false, reason: "limit", status };

  const slot = status.used + 1;
  const wanted = providerForSlot(slot);
  const browserHash = sha256(args.browserId);

  // Same visitor retrying the same course: hand back the link they already
  // have, as long as it is still the shortener due for today's next slot.
  const pending = await db.freeUnlockSession.findFirst({
    where: {
      subjectKey: args.subject.key,
      courseId: args.course.id,
      browserHash,
      completedAt: null,
      slot,
      expiresAt: { gt: new Date(now.getTime() + 5 * 60_000) },
      createdAt: { gt: new Date(now.getTime() - REUSE_WINDOW_MS) },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (pending) return { ok: true, sessionId: pending.id };

  const config = await getFreeConfig();
  const token = randomBytes(32).toString("base64url");
  const returnUrl = `${args.origin.replace(/\/$/, "")}/unlock/${token}`;

  let provider: ShortenerProvider | "none" = "none";
  let shortUrl = returnUrl;
  for (const p of fallbackChain(wanted, config)) {
    const url = await shortenWith(p, returnUrl);
    if (url) {
      provider = p;
      shortUrl = url;
      break;
    }
    console.error(`[free-unlock] ${p} unavailable for slot ${slot} (${args.course.slug}); trying the next shortener`);
  }
  if (provider === "none") {
    // Never leave a user stuck: every shortener is down, so the return URL is
    // used as-is. It still goes through /unlock and still counts.
    console.error(`[free-unlock] every shortener failed for ${args.course.slug}; sending the return link directly`);
  } else if (provider !== wanted) {
    console.warn(`[free-unlock] slot ${slot}: wanted ${wanted}, fell back to ${provider}`);
  }

  const session = await db.freeUnlockSession.create({
    data: {
      tokenHash: sha256(token),
      subjectKey: args.subject.key,
      courseId: args.course.id,
      slot,
      wantedProvider: wanted,
      provider,
      shortUrl,
      browserHash,
      ipHash: args.ipHash,
      telegramUserId: args.subject.telegramUserId,
      userId: args.subject.userId,
      minCompleteAt: new Date(now.getTime() + (provider === "none" ? 0 : MIN_COMPLETION_MS)),
      expiresAt: new Date(now.getTime() + UNLOCK_TTL_MS),
    },
    select: { id: true },
  });
  return { ok: true, sessionId: session.id };
}

export async function getSessionShortUrl(sessionId: string, now = new Date()) {
  return db.freeUnlockSession.findFirst({
    where: { id: sessionId, completedAt: null, expiresAt: { gt: now } },
    select: { shortUrl: true, courseId: true },
  });
}

export type CompleteResult =
  | {
      ok: true;
      courseId: string;
      outcome: "unlocked" | "already";
      used: number;
      limit: number;
      telegramUserId: string | null;
      ipHash: string;
    }
  | {
      ok: false;
      reason: "invalid" | "used" | "expired" | "browser" | "early" | "limit";
      courseId?: string;
    };

/**
 * Verifies the return from a shortener and, if everything holds, counts the
 * unlock. Runs under row locks so two returns at once can neither both pass
 * the limit nor both spend the same token.
 */
export async function completeUnlock(args: {
  token: string;
  browserId: string | null;
  now?: Date;
}): Promise<CompleteResult> {
  const now = args.now ?? new Date();
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(args.token)) return { ok: false, reason: "invalid" };
  const tokenHash = sha256(args.token);
  const config = await getFreeConfig();
  const today = istDay(now);

  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "free_unlock_sessions" WHERE "tokenHash" = ${tokenHash} FOR UPDATE`;
    if (rows.length === 0) return { ok: false, reason: "invalid" } as const;
    const s = await tx.freeUnlockSession.findUniqueOrThrow({ where: { id: rows[0]!.id } });
    const courseId = s.courseId;

    if (s.completedAt) return { ok: false, reason: "used", courseId } as const;
    if (s.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired", courseId } as const;
    if (!args.browserId || sha256(args.browserId) !== s.browserHash) {
      return { ok: false, reason: "browser", courseId } as const;
    }
    if (now.getTime() < s.minCompleteAt.getTime()) return { ok: false, reason: "early", courseId } as const;

    const finish = (outcome: string) =>
      tx.freeUnlockSession.update({ where: { id: s.id }, data: { completedAt: now, outcome } });

    const existing = await tx.freeUnlock.findUnique({
      where: { subjectKey_courseId: { subjectKey: s.subjectKey, courseId } },
      select: { id: true },
    });

    await tx.$executeRaw`
      INSERT INTO "free_unlock_quotas" ("subjectKey", "day", "count", "updatedAt")
      VALUES (${s.subjectKey}, ${today}, 0, NOW())
      ON CONFLICT ("subjectKey") DO NOTHING`;
    const q = await tx.$queryRaw<{ day: string; count: number }[]>`
      SELECT "day", "count" FROM "free_unlock_quotas" WHERE "subjectKey" = ${s.subjectKey} FOR UPDATE`;
    const used = usedToday(q[0] ?? null, today);

    if (existing) {
      await finish("already");
      return { ok: true, courseId, outcome: "already", used, limit: config.limit, telegramUserId: s.telegramUserId, ipHash: s.ipHash } as const;
    }
    if (used >= config.limit) {
      await finish("limit");
      return { ok: false, reason: "limit", courseId } as const;
    }

    await tx.freeUnlockQuota.update({
      where: { subjectKey: s.subjectKey },
      data: { day: today, count: used + 1 },
    });
    await tx.freeUnlock.create({
      data: { subjectKey: s.subjectKey, courseId, provider: s.provider, day: today, sessionId: s.id },
    });
    await finish("unlocked");
    console.info(`[free-unlock] ${s.subjectKey.split(":")[0]} unlocked course via ${s.provider} (${used + 1}/${config.limit} today)`);
    return {
      ok: true,
      courseId,
      outcome: "unlocked",
      used: used + 1,
      limit: config.limit,
      telegramUserId: s.telegramUserId,
      ipHash: s.ipHash,
    } as const;
  });
}

/** Housekeeping: drop attempts that ended or expired more than a week ago. */
export async function pruneUnlockSessions(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const r = await db.freeUnlockSession.deleteMany({ where: { expiresAt: { lt: cutoff } } });
  return r.count;
}
