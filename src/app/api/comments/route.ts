import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listTopLevelComments, listReplies, attachLikedByMe } from "@/lib/comments";
import { listCommentsQuerySchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/ip";

export async function GET(request: NextRequest) {
  const ip = await getClientIp();
  const rl = checkRateLimit(`api-comments:${hashIp(ip)}`, { limit: 120, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = listCommentsQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const { courseId, parentId, sort, cursor } = parsed.data;
  const session = await auth();
  const userId = session?.user?.id ?? null;

  // Per-user like state means this response can't be a shared/public cache.
  const cacheControl = userId ? "private, no-store" : "public, s-maxage=30, stale-while-revalidate=120";

  if (parentId) {
    const { items, nextCursor } = await listReplies(parentId, cursor ?? null);
    return NextResponse.json(
      { items: await attachLikedByMe(items, userId), nextCursor },
      { headers: { "Cache-Control": cacheControl } }
    );
  }

  if (!courseId) {
    return NextResponse.json({ error: "courseId or parentId is required" }, { status: 400 });
  }
  const { items, nextCursor } = await listTopLevelComments(courseId, { sort, cursor });
  return NextResponse.json(
    { items: await attachLikedByMe(items, userId), nextCursor },
    { headers: { "Cache-Control": cacheControl } }
  );
}
