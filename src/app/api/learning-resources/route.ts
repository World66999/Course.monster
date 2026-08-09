import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listLearningResources, attachMyResourceState } from "@/lib/learning-resources";
import { listLearningResourcesQuerySchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/ip";

export async function GET(request: NextRequest) {
  const ip = await getClientIp();
  const rl = checkRateLimit(`api-learning-resources:${hashIp(ip)}`, { limit: 120, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = listLearningResourcesQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const { items, nextCursor, total } = await listLearningResources(parsed.data, userId);
  const myState = await attachMyResourceState(items, userId);

  const cards = items.map((item) => ({
    ...item,
    bookmarkedByMe: myState.get(item.id)!.bookmarked,
  }));

  const cacheControl = userId ? "private, no-store" : "public, s-maxage=60, stale-while-revalidate=300";
  return NextResponse.json({ items: cards, nextCursor, total }, { headers: { "Cache-Control": cacheControl } });
}
