import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { consumeDownloadToken } from "@/lib/download-token";
import { getSessionShortUrl, hasUnlocked } from "@/lib/free-unlocks";
import { getClientIp, hashIp, siteOrigin } from "@/lib/ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { isSafeExternalUrl } from "@/lib/safe-url";
import { canAccessPremiumCourse, canDownloadDirect } from "@/lib/premium";

/**
 * Final step of the download flow: validates the single-use token and
 * answers with a server-side 302. Premium tokens and already-unlocked free
 * courses go to the destination; a free unlock goes to its shortener link,
 * which returns the visitor to /unlock/<token> once its steps are done. The
 * destination only ever appears in the Location header of a response.
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
  let isDownload = true;
  if (result.direct || course.premium) {
    // Premium: straight to the destination, no shortener.
    target = course.downloadUrl;
  } else if (result.reopenSubject) {
    // Unlocked earlier by this same visitor: re-opening is free.
    if (!(await hasUnlocked(result.reopenSubject, course.id))) {
      return NextResponse.redirect(new URL(`/download/${course.slug}`, home), { status: 302, headers: { "Cache-Control": "no-store" } });
    }
    target = course.downloadUrl;
  } else if (result.unlockSessionId) {
    const pending = await getSessionShortUrl(result.unlockSessionId);
    if (!pending || pending.courseId !== course.id) {
      return NextResponse.redirect(new URL(`/download/${course.slug}`, home), { status: 302, headers: { "Cache-Control": "no-store" } });
    }
    target = pending.shortUrl;
    // Not a download yet — /unlock records it once the shortener is done.
    isDownload = false;
  } else {
    // A free token minted before daily unlocks existed: start over.
    return NextResponse.redirect(new URL(`/download/${course.slug}`, home), { status: 302, headers: { "Cache-Control": "no-store" } });
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
  if (isDownload) {
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
