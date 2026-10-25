import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runPremiumJobs } from "@/lib/premium-jobs";

/**
 * Optional external trigger for the Premium expiry/reminder job. The job also
 * runs in-process every 15 minutes (src/instrumentation.ts); this endpoint is
 * for setups that prefer a system cron (PREMIUM_JOBS=off). The job is
 * idempotent, so running both is harmless.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function equals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export async function POST(request: NextRequest) {
  const expected = process.env.PREMIUM_CRON_SECRET;
  if (!expected) return new NextResponse("Not found", { status: 404 });
  const provided = request.headers.get("x-cron-secret") ?? "";
  if (!provided || !equals(provided, expected)) return new NextResponse("Forbidden", { status: 403 });
  try {
    return NextResponse.json({ ok: true, ...(await runPremiumJobs()) });
  } catch (err) {
    console.error("[premium-jobs] cron run failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
