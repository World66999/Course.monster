import { NextRequest, NextResponse } from "next/server";
import { handleRazorpayWebhook } from "@/lib/razorpay-payments";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/ip";

/**
 * Razorpay webhook endpoint.
 *
 * Authenticity comes from X-Razorpay-Signature alone: HMAC-SHA256 of the raw
 * body with RAZORPAY_WEBHOOK_SECRET, checked before the body is parsed. The
 * route sits under /api, outside the auth middleware, and takes no cookies.
 * Processing is idempotent, so Razorpay's retries are always safe.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Real webhook bodies are a few KiB. */
const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: NextRequest) {
  const ipKey = hashIp(await getClientIp());
  const rl = checkRateLimit(`rzp-webhook:${ipKey}`, { limit: 240, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ ok: false }, { status: 413 });

  // Raw text, exactly as sent: the signature covers these bytes.
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return NextResponse.json({ ok: false }, { status: 413 });

  try {
    const result = await handleRazorpayWebhook(
      raw,
      request.headers.get("x-razorpay-signature"),
      request.headers.get("x-razorpay-event-id")
    );
    return NextResponse.json({ ok: result.httpStatus === 200 }, { status: result.httpStatus });
  } catch (err) {
    // 500 makes Razorpay retry later (database restart, API timeout).
    console.error("[razorpay-webhook] processing failed:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET() {
  return new NextResponse("Not found", { status: 404 });
}
