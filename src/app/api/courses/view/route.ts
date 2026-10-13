import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp, isTrustedOrigin } from "@/lib/ip";

const bodySchema = z.object({ slug: z.string().regex(/^[a-z0-9-]{1,200}$/) });

/**
 * Counts one course view.
 *
 * The course page is cached, so it can no longer count views while
 * rendering — a render now happens once per revalidation, not once per
 * visitor. The page sends this beacon after it loads instead.
 *
 * At most one counted view per visitor (hashed IP) per course per 30 minutes,
 * which matches what "views" is meant to show and stops a reload loop from
 * inflating it. Always answers 204 so the beacon never surfaces an error.
 */
export async function POST(request: NextRequest) {
  const done = new NextResponse(null, { status: 204 });
  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (!isTrustedOrigin(origin, request.nextUrl.origin)) return done;

  const ipHash = hashIp(await getClientIp());
  if (!checkRateLimit(`course-view-ip:${ipHash}`, { limit: 60, windowMs: 60_000 }).ok) return done;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return done;
  const { slug } = parsed.data;

  if (!checkRateLimit(`course-view:${ipHash}:${slug}`, { limit: 1, windowMs: 30 * 60_000 }).ok) return done;

  await db.course
    .updateMany({ where: { slug, published: true }, data: { views: { increment: 1 } } })
    .catch(() => undefined);
  return done;
}
