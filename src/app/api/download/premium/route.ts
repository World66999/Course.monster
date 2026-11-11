import { NextRequest, NextResponse } from "next/server";
import { z } from "@/lib/zod";
import { db } from "@/lib/db";
import { createDownloadToken } from "@/lib/download-token";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp, isTrustedOrigin } from "@/lib/ip";
import { getViewer } from "@/server/premium-guard";
import { canAccessPremiumCourse } from "@/lib/premium";

/**
 * Premium instant download: no countdown, no challenge, no captcha, no ad
 * short link. Everything that made the free path slow is replaced by one
 * server-side check — an active subscription (or, for a premium course, a
 * per-user grant). The result is the same short-lived, single-use, IP-bound
 * /go token the free path issues, flagged `direct` inside its signature.
 */

const bodySchema = z.object({ slug: z.string().min(1).max(120) });

export async function POST(request: NextRequest) {
  // Strict origin check: unlike the free path this one acts on the session
  // cookie, so a cross-site POST must not be able to trigger it.
  const origin = request.headers.get("origin");
  if (!origin || !isTrustedOrigin(origin, request.nextUrl.origin)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Please sign in.", code: "auth" }, { status: 401 });

  const ipKey = hashIp(await getClientIp());
  const rl = checkRateLimit(`download-premium:${viewer.id}`, { limit: 30, windowMs: 5 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many downloads in a short time. Please wait a moment." },
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
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const course = await db.course.findFirst({
    where: { slug: parsed.data.slug, published: true },
    select: { id: true, premium: true },
  });
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  // Any course: instant for subscribers. A premium course: subscribers, staff,
  // or a user the admin granted that specific course to.
  const allowed = course.premium ? await canAccessPremiumCourse(viewer.id, course.id) : viewer.premium;
  if (!allowed) {
    return NextResponse.json({ error: "Premium required", code: "premium" }, { status: 403 });
  }

  const token = createDownloadToken(course.id, ipKey, undefined, { direct: true, userId: viewer.id });
  return NextResponse.json(
    { redirectUrl: `/go/${token}` },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
