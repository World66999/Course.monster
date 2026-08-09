import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSiteSettings } from "@/lib/settings";
import { listCourseRequests, attachMyRequestState, toRequestCard } from "@/lib/course-requests";
import { listCourseRequestsQuerySchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/ip";

export async function GET(request: NextRequest) {
  const ip = await getClientIp();
  const rl = checkRateLimit(`api-course-requests:${hashIp(ip)}`, { limit: 120, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = listCourseRequestsQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const [settings, { items, nextCursor, total }] = await Promise.all([
    getSiteSettings(),
    listCourseRequests(parsed.data, userId),
  ]);
  const myState = await attachMyRequestState(items, userId);

  const cards = items.map((item) =>
    toRequestCard(item, {
      votedByMe: myState.get(item.id)!.voted,
      bookmarkedByMe: myState.get(item.id)!.bookmarked,
      followedByMe: myState.get(item.id)!.followed,
      currentUserId: userId,
      popularThreshold: settings.courseRequests.popularVoteThreshold,
    })
  );

  // Per-user vote/bookmark/mine state means this can't be a shared/public cache.
  const cacheControl = userId ? "private, no-store" : "public, s-maxage=30, stale-while-revalidate=120";
  return NextResponse.json({ items: cards, nextCursor, total }, { headers: { "Cache-Control": cacheControl } });
}
