import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { BROWSER_COOKIE, completeUnlock } from "@/lib/free-unlocks";
import { getClientIp, hashIp, siteOrigin } from "@/lib/ip";
import { checkVisitorRateLimit } from "@/lib/visitor-rate-limit";
import { isSafeExternalUrl } from "@/lib/safe-url";

/**
 * Where a shortener sends the visitor once its steps are done. The token is
 * one-time, bound to the subject + course + browser that started the unlock,
 * and expires; only a valid return counts toward today's free unlocks (see
 * free-unlocks.ts). Success goes straight to the course; anything else goes
 * back to the download page with a short reason it can explain.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const home = new URL("/", siteOrigin(request.nextUrl.origin));
  const ipKey = hashIp(await getClientIp());
  const noStore = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

  const deviceCookie = request.cookies.get(BROWSER_COOKIE)?.value;
  if (!checkVisitorRateLimit("unlock", ipKey, deviceCookie, { limit: 20, windowMs: 5 * 60_000 }).ok) {
    return NextResponse.redirect(home, { headers: noStore });
  }

  const { token } = await params;
  let result;
  try {
    result = await completeUnlock({ token: token ?? "", browserId: deviceCookie ?? null });
  } catch (err) {
    console.error("[unlock] verification failed:", err);
    return NextResponse.redirect(home, { headers: noStore });
  }

  const course = result.courseId
    ? await db.course.findFirst({
        where: { id: result.courseId, published: true },
        select: { id: true, slug: true, downloadUrl: true },
      })
    : null;
  if (!course) return NextResponse.redirect(home, { headers: noStore });

  if (!result.ok) {
    console.warn(`[unlock] refused (${result.reason}) for course ${course.slug}`);
    const back = new URL(`/download/${course.slug}`, home);
    back.searchParams.set("unlock", result.reason);
    return NextResponse.redirect(back, { status: 302, headers: noStore });
  }

  if (!isSafeExternalUrl(course.downloadUrl)) {
    console.error("[download] refusing to redirect to an unsafe target for course", course.slug);
    return NextResponse.redirect(home, { headers: noStore });
  }

  try {
    await db.$transaction([
      db.downloadEvent.create({
        data: {
          courseId: course.id,
          ipHash: ipKey,
          userAgent: request.headers.get("user-agent")?.slice(0, 255) ?? null,
          source: result.telegramUserId ? "telegram" : null,
          telegramUserId: result.telegramUserId,
        },
      }),
      db.course.update({ where: { id: course.id }, data: { downloads: { increment: 1 } } }),
    ]);
  } catch (err) {
    console.error("[download] failed to record download event:", err);
  }

  return NextResponse.redirect(course.downloadUrl, {
    status: 302,
    headers: { ...noStore, "Referrer-Policy": "no-referrer" },
  });
}
