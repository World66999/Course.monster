import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { consumeDownloadToken } from "@/lib/download-token";
import { getShortLink } from "@/lib/shortener";
import { getClientIp, hashIp } from "@/lib/ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { isSafeExternalUrl } from "@/lib/safe-url";

/**
 * Final step of the download flow: validates the single-use token and
 * answers with a server-side 302 to the short link. The destination only
 * ever appears in the Location header of this response.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const home = new URL("/", request.nextUrl.origin);
  const ip = await getClientIp();
  const ipKey = hashIp(ip);

  const rl = checkRateLimit(`go:${ipKey}`, { limit: 20, windowMs: 5 * 60_000 });
  if (!rl.ok) return NextResponse.redirect(home);

  const { token } = await params;
  if (!token || token.length > 1024) return NextResponse.redirect(home);

  const result = consumeDownloadToken(token, ipKey);
  if (!result.ok) {
    // Point the user back at the gate when we can still tell which course.
    return NextResponse.redirect(home);
  }

  const course = await db.course.findFirst({
    where: { id: result.courseId, published: true },
    select: { id: true, slug: true, downloadUrl: true },
  });
  if (!course) return NextResponse.redirect(home);

  let target: string;
  try {
    ({ url: target } = await getShortLink(course));
  } catch {
    return NextResponse.redirect(home);
  }
  // Defence in depth: the form layer now rejects non-http(s) download URLs, but
  // this value also comes back from an external shortener, so never emit a
  // Location header for a scheme we didn't intend to send anyone to.
  if (!isSafeExternalUrl(target)) {
    console.error("[download] refusing to redirect to an unsafe target for course", course.slug);
    return NextResponse.redirect(home);
  }

  // Record the download without delaying the redirect response meaningfully.
  const userAgent = request.headers.get("user-agent")?.slice(0, 255) ?? null;
  try {
    await db.$transaction([
      db.downloadEvent.create({
        data: { courseId: course.id, ipHash: ipKey, userAgent },
      }),
      db.course.update({
        where: { id: course.id },
        data: { downloads: { increment: 1 } },
      }),
    ]);
  } catch (err) {
    console.error("[download] failed to record download event:", err);
  }

  return NextResponse.redirect(target, {
    status: 302,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
