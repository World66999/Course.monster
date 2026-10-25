import { NextRequest, NextResponse } from "next/server";
import { processIpn } from "@/lib/payments";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/ip";

/**
 * NOWPayments IPN endpoint.
 *
 * Authenticity comes from the x-nowpayments-sig HMAC alone (verified in
 * processIpn against NOWPAYMENTS_IPN_SECRET); this route only bounds what it
 * is willing to read. It sits under /api, outside the auth middleware, and
 * takes no cookies, so there is no session for a forged request to ride on.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Real IPN bodies are well under 2 KiB. */
const MAX_BODY_BYTES = 32 * 1024;

export async function POST(request: NextRequest) {
  const ipKey = hashIp(await getClientIp());
  // Generous: NOWPayments sends a handful of updates per payment, but a flood
  // of forged calls should not be able to fill the event log.
  const rl = checkRateLimit(`ipn:${ipKey}`, { limit: 120, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ ok: false }, { status: 413 });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ ok: false }, { status: 413 });

  try {
    const result = await processIpn(raw, request.headers.get("x-nowpayments-sig"));
    return NextResponse.json({ ok: result.httpStatus === 200 }, { status: result.httpStatus });
  } catch (err) {
    // 500 makes NOWPayments retry later, which is what we want for a transient
    // fault (database restart). Processing is idempotent, so a retry is safe.
    console.error("[ipn] processing failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET() {
  return new NextResponse("Not found", { status: 404 });
}
