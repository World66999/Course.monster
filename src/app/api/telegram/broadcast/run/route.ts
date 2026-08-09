import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { resumePendingBroadcasts } from "@/lib/telegram/broadcast";

/**
 * Cron-driven broadcast pump.
 *
 * Broadcast delivery is paced and can outlive a single request, so a scheduled
 * caller advances it. This also makes delivery survive a blue/green cutover:
 * whatever was left PENDING is picked up on the next tick.
 *
 * Not reachable without the shared secret, and never exposed in the UI.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function equals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export async function POST(request: NextRequest) {
  const expected = process.env.TELEGRAM_CRON_SECRET;
  if (!expected) {
    console.error("[telegram] TELEGRAM_CRON_SECRET is not set — broadcast pump disabled");
    return new NextResponse("Not found", { status: 404 });
  }
  const provided = request.headers.get("x-cron-secret") ?? "";
  if (!provided || !equals(provided, expected)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const summaries = await resumePendingBroadcasts();
    return NextResponse.json({ ok: true, runs: summaries });
  } catch (err) {
    console.error("[telegram] broadcast pump failed:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
