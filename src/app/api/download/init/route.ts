import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyCaptcha } from "@/lib/captcha";
import { createDownloadToken } from "@/lib/download-token";
import { consumePageTicket } from "@/lib/page-ticket";
import { consumeHumanTicket } from "@/lib/verify-challenge";
import { getShortLink } from "@/lib/shortener";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp, isTrustedOrigin } from "@/lib/ip";
import { verifyAttributionToken } from "@/lib/telegram/attribution";

const bodySchema = z.object({
  slug: z.string().min(1).max(120),
  captchaToken: z.string().max(4096).optional().default(""),
  humanTicket: z.string().min(1).max(4096),
  /** Opaque signed attribution blob from the Telegram bot. Optional, never trusted. */
  attribution: z.string().max(512).optional().default(""),
});

/**
 * Step 2 of the download flow: called from the protected download page after
 * the countdown + captcha. Verifies everything server-side, warms the short
 * link cache, and returns a short-lived single-use /go token. The actual
 * short URL is never returned to the client here.
 */
export async function POST(request: NextRequest) {
  // The page-ticket cookie is single-use regardless of outcome below, so
  // every response clears it.
  function respond(payload: Record<string, unknown>, init?: ResponseInit): NextResponse {
    const res = NextResponse.json(payload, init);
    res.cookies.delete("dl_ticket");
    return res;
  }

  const ip = await getClientIp();
  const ipKey = hashIp(ip);

  const rl = checkRateLimit(`download-init:${ipKey}`, { limit: 10, windowMs: 5 * 60_000 });
  if (!rl.ok) {
    return respond(
      { error: "Too many download attempts. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  // Cheap defense-in-depth: only reject when the header is present and
  // wrong — some browsers/extensions legitimately omit it, and the page
  // ticket below is the load-bearing check, not this.
  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (!isTrustedOrigin(origin, request.nextUrl.origin)) {
    return respond({ error: "Invalid request origin." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respond({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return respond({ error: "Invalid request" }, { status: 400 });
  }

  // Proves this request followed an actual GET of the download page for
  // this exact course, not a replayed/synthesized POST — fails closed
  // since a real user always has a fresh ticket by the time the button is
  // clickable (countdown + captcha take well over the mint time).
  const ticket = request.cookies.get("dl_ticket")?.value;
  const ticketResult = ticket
    ? await consumePageTicket(ticket, parsed.data.slug)
    : ({ ok: false, reason: "invalid" } as const);
  if (!ticketResult.ok) {
    return respond(
      { error: "Please reload the download page and try again." },
      { status: 403 }
    );
  }

  // Additional layer, independent of the checks above: proves the client
  // actually completed the interactive verification gateway for this exact
  // course, via its own short-lived single-use ticket (see
  // verify-challenge.ts). Never replaces the page-ticket/captcha checks.
  const humanResult = consumeHumanTicket(parsed.data.humanTicket, parsed.data.slug);
  if (!humanResult.ok) {
    return respond(
      { error: "Please complete verification again." },
      { status: 403 }
    );
  }

  const captchaConfigured =
    Boolean(process.env.TURNSTILE_SECRET_KEY) &&
    Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  if (captchaConfigured) {
    const human = await verifyCaptcha(parsed.data.captchaToken, ip);
    if (!human) {
      return respond(
        { error: "Captcha verification failed. Please try again." },
        { status: 403 }
      );
    }
  } else {
    console.warn("[download] Turnstile keys not configured — captcha check skipped");
  }

  const course = await db.course.findFirst({
    where: { slug: parsed.data.slug, published: true },
    select: { id: true, slug: true, downloadUrl: true },
  });
  if (!course) {
    return respond({ error: "Course not found" }, { status: 404 });
  }

  // Warm the short-link cache now so the /go redirect is instant.
  try {
    await getShortLink(course);
  } catch (err) {
    console.error("[download] failed to prepare link:", err);
    return respond(
      { error: "Download link is temporarily unavailable. Please try again later." },
      { status: 502 }
    );
  }

  // Attribution is resolved only after every gate above has already passed and
  // the course has been looked up by slug. It cannot select a course, relax a
  // check, or change the outcome — an invalid token just means "unattributed".
  let attribution: { source: string; telegramUserId: string } | undefined;
  if (parsed.data.attribution) {
    const telegramUserId = verifyAttributionToken(parsed.data.attribution, course.id);
    if (telegramUserId) attribution = { source: "telegram", telegramUserId };
  }

  const token = createDownloadToken(course.id, ipKey, attribution);
  return respond({ redirectUrl: `/go/${token}` });
}
