import { NextRequest, NextResponse } from "next/server";
import { listReviews } from "@/lib/comments";
import { listReviewsQuerySchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/ip";

export async function GET(request: NextRequest) {
  const ip = await getClientIp();
  const rl = checkRateLimit(`api-reviews:${hashIp(ip)}`, { limit: 120, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = listReviewsQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const result = await listReviews(parsed.data.courseId, { sort: parsed.data.sort, cursor: parsed.data.cursor });
  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" },
  });
}
