import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp, isTrustedOrigin } from "@/lib/ip";
import { istDay } from "@/lib/shortener-core";

/** Crawlers and link-preview fetchers are not visitors. */
const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegrambot|lighthouse|headless|monitor|curl|wget|python|okhttp/i;
const KEEP_DAYS = 180;

/**
 * Counts one page view for the admin dashboard's visitor chart.
 *
 * Privacy: no cookie and no account. A visitor is a hash of (today's IST date,
 * the already-hashed IP, the browser string), so the same person hashes
 * differently tomorrow and nothing here can be tied back to anyone. It is an
 * approximation by design (people behind one mobile-carrier IP with the same
 * phone model count once).
 *
 * Always answers 204, so the page's beacon never surfaces an error, and it
 * grants nothing: no other code reads this table.
 */
export async function POST(request: NextRequest) {
  const done = new NextResponse(null, { status: 204 });
  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (!isTrustedOrigin(origin, request.nextUrl.origin)) return done;

  const ua = (request.headers.get("user-agent") ?? "").slice(0, 300);
  if (!ua || BOT_UA.test(ua)) return done;

  const ipHash = hashIp(await getClientIp());
  if (!checkRateLimit(`visit:${ipHash}`, { limit: 90, windowMs: 60_000 }).ok) return done;

  const day = istDay();
  const visitorHash = createHash("sha256").update(`${day}:${ipHash}:${ua}`).digest("hex").slice(0, 32);
  try {
    await db.siteVisit.upsert({
      where: { day_visitorHash: { day, visitorHash } },
      create: { day, visitorHash },
      update: { views: { increment: 1 } },
    });
    // Occasional housekeeping instead of a scheduled job.
    if (Math.random() < 0.002) {
      const cutoff = istDay(new Date(Date.now() - KEEP_DAYS * 86_400_000));
      await db.siteVisit.deleteMany({ where: { day: { lt: cutoff } } });
    }
  } catch {
    // Counting must never break a page view.
  }
  return done;
}
