import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { handleUpdate, type Update } from "@/lib/telegram/handlers";
import { webhookPathSegment, webhookSecret } from "@/lib/telegram/config";

/**
 * Telegram webhook endpoint.
 *
 * Two independent gates: an unguessable path segment, and Telegram's own
 * secret-token mechanism (`X-Telegram-Bot-Api-Secret-Token`, set via
 * setWebhook). The bot token itself never appears in this URL.
 *
 * This route sits under /api, which the auth middleware's matcher excludes, so
 * no session handling applies and none is wanted.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 1 MiB is far above any legitimate update; anything larger is refused unread. */
const MAX_BODY_BYTES = 1024 * 1024;

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ segment: string }> }) {
  const { segment } = await params;

  let expectedSegment: string;
  let expectedSecret: string;
  try {
    expectedSegment = webhookPathSegment();
    expectedSecret = webhookSecret();
  } catch {
    // Misconfigured server: never hint at why.
    console.error("[telegram] webhook is not configured (missing path segment or secret)");
    return new NextResponse("Not found", { status: 404 });
  }

  if (!constantTimeEquals(segment, expectedSegment)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const provided = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!provided || !constantTimeEquals(provided, expectedSecret)) {
    console.warn("[telegram] rejected webhook call with a missing/invalid secret token");
    return new NextResponse("Forbidden", { status: 403 });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return new NextResponse("Payload too large", { status: 413 });
  }

  let update: Update;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return new NextResponse("Payload too large", { status: 413 });
    update = JSON.parse(raw) as Update;
  } catch {
    // A malformed body is not worth redelivering.
    console.warn("[telegram] discarded a malformed update body");
    return NextResponse.json({ ok: true });
  }

  if (!update || typeof update !== "object" || typeof update.update_id !== "number") {
    console.warn("[telegram] discarded an update with no update_id");
    return NextResponse.json({ ok: true });
  }

  try {
    await handleUpdate(update);
  } catch (err) {
    // Always 200: a non-2xx makes Telegram redeliver, and a persistent fault
    // would turn into a redelivery storm. The failure is logged instead.
    console.error(`[telegram] update ${update.update_id} failed:`, err);
  }

  return NextResponse.json({ ok: true });
}

/** Anything other than Telegram's POST gets nothing useful. */
export async function GET() {
  return new NextResponse("Not found", { status: 404 });
}
