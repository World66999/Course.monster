import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

const querySchema = z.object({ courseId: z.string().cuid() });

/**
 * The signed-in viewer's own review of a course, or null.
 *
 * The course page is cached and identical for everyone, so the one piece of
 * it that depends on who is looking — "you already reviewed this, edit it" —
 * is fetched here after hydration instead of being rendered on the server.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ review: null }, { headers: { "Cache-Control": "private, no-store" } });

  const rl = checkRateLimit(`api-reviews-mine:${userId}`, { limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  const review = await db.review.findFirst({
    where: { courseId: parsed.data.courseId, userId, status: { not: "DELETED" } },
    select: { id: true, rating: true, title: true, body: true },
  });
  return NextResponse.json(
    { review: review ? { ...review, title: review.title ?? "" } : null },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
