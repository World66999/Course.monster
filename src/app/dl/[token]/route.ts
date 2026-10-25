import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyHandoffToken } from "@/lib/download-token";
import { getClientIp, hashIp, siteOrigin } from "@/lib/ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { isSafeExternalUrl } from "@/lib/safe-url";
import { canDownloadDirect } from "@/lib/premium";

/**
 * Premium direct link from the Telegram bot. The token names the linked user
 * and course; whether that user may skip the steps is decided here, from the
 * database, on every open. Anyone else — including the same member after
 * their Premium ends — is sent to the normal download page instead.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const home = new URL("/", siteOrigin(request.nextUrl.origin));
  const ipKey = hashIp(await getClientIp());
  if (!checkRateLimit(`dl:${ipKey}`, { limit: 20, windowMs: 5 * 60_000 }).ok) return NextResponse.redirect(home);

  const { token } = await params;
  if (!token || token.length > 1024) return NextResponse.redirect(home);
  const result = verifyHandoffToken(token);
  if (!result.ok) return NextResponse.redirect(home);

  const course = await db.course.findFirst({
    where: { id: result.courseId, published: true },
    select: { id: true, slug: true, downloadUrl: true, premium: true },
  });
  if (!course) return NextResponse.redirect(home);

  if (!(await canDownloadDirect(result.userId, course))) {
    const back = new URL(course.premium ? "/premium" : `/download/${course.slug}`, home);
    return NextResponse.redirect(back, { status: 302, headers: { "Cache-Control": "no-store" } });
  }
  if (!isSafeExternalUrl(course.downloadUrl)) {
    console.error("[download] refusing to redirect to an unsafe target for course", course.slug);
    return NextResponse.redirect(home);
  }

  try {
    await db.$transaction([
      db.downloadEvent.create({
        data: {
          courseId: course.id,
          ipHash: ipKey,
          userAgent: request.headers.get("user-agent")?.slice(0, 255) ?? null,
          source: "premium",
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
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" },
  });
}
