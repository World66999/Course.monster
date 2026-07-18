import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyCaptcha } from "@/lib/captcha";
import { createDownloadToken } from "@/lib/download-token";
import { getShortLink } from "@/lib/shortener";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/ip";

const bodySchema = z.object({
  slug: z.string().min(1).max(120),
  captchaToken: z.string().max(4096).optional().default(""),
});

/**
 * Step 2 of the download flow: called from the protected download page after
 * the countdown + captcha. Verifies everything server-side, warms the short
 * link cache, and returns a short-lived single-use /go token. The actual
 * short URL is never returned to the client here.
 */
export async function POST(request: NextRequest) {
  const ip = await getClientIp();
  const ipKey = hashIp(ip);

  const rl = checkRateLimit(`download-init:${ipKey}`, { limit: 10, windowMs: 5 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many download attempts. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const captchaConfigured =
    Boolean(process.env.TURNSTILE_SECRET_KEY) &&
    Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  if (captchaConfigured) {
    const human = await verifyCaptcha(parsed.data.captchaToken, ip);
    if (!human) {
      return NextResponse.json(
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
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // Warm the short-link cache now so the /go redirect is instant.
  try {
    await getShortLink(course);
  } catch (err) {
    console.error("[download] failed to prepare link:", err);
    return NextResponse.json(
      { error: "Download link is temporarily unavailable. Please try again later." },
      { status: 502 }
    );
  }

  const token = createDownloadToken(course.id, ipKey);
  return NextResponse.json({ redirectUrl: `/go/${token}` });
}
