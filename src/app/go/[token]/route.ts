import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { consumeDownloadToken } from "@/lib/download-token";
import { getShortLink } from "@/lib/shortener";
import { getClientIp, hashIp, siteOrigin } from "@/lib/ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { isSafeExternalUrl } from "@/lib/safe-url";
import { canAccessPremiumCourse, canDownloadDirect } from "@/lib/premium";

/**
 * Final step of the download flow: validates the single-use token and
 * answers with a server-side 302 to the short link. The destination only
 * ever appears in the Location header of this response.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  // The public origin, not `nextUrl.origin`. Behind the reverse proxy the
  // latter is whatever host header reached the Node process, so every "that
  // link is spent, go back to the site" redirect risked pointing the visitor
  // at an internal address they cannot reach.
  const home = new URL("/", siteOrigin(request.nextUrl.origin));
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
    select: { id: true, slug: true, downloadUrl: true, premium: true },
  });
  if (!course) return NextResponse.redirect(home);

  // Access is re-read at the moment of the redirect, not trusted from when the
  // token was minted: if Premium lapsed or was revoked since, a direct token
  // falls back to the normal steps and a premium-course token is refused.
  if (result.direct || course.premium) {
    const allowed =
      result.userId !== null &&
      (result.direct
        ? await canDownloadDirect(result.userId, course)
        : await canAccessPremiumCourse(result.userId, course.id));
    if (!allowed) {
      const back = new URL(course.premium ? "/premium" : `/download/${course.slug}`, home);
      return NextResponse.redirect(back, { status: 302, headers: { "Cache-Control": "no-store" } });
    }
  }

  let target: string;
  if (result.direct) {
    // Premium: straight to the destination, no ad-supported short link.
    target = course.downloadUrl;
  } else {
    try {
      ({ url: target } = await getShortLink(course));
    } catch {
      return NextResponse.redirect(home);
    }
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
        data: {
          courseId: course.id,
          ipHash: ipKey,
          userAgent,
          source: result.direct ? "premium" : (result.attribution?.source ?? null),
          telegramUserId: result.attribution?.telegramUserId ?? null,
        },
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
