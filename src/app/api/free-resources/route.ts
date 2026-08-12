import { NextRequest, NextResponse } from "next/server";
import { listFreeResources } from "@/lib/free-resources";
import { listFreeResourcesQuerySchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/ip";

/**
 * Read-only pagination endpoint for the Free Resources grid. Same shape,
 * limits and caching as /api/apps: published rows only (enforced in
 * listFreeResources, not here), no auth, no writes.
 */
export async function GET(request: NextRequest) {
  const ip = await getClientIp();
  const rl = checkRateLimit(`api-free-resources:${hashIp(ip)}`, { limit: 120, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = listFreeResourcesQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  try {
    const { items, nextCursor, total } = await listFreeResources(parsed.data);
    return NextResponse.json(
      { items, nextCursor, total },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch (err) {
    // A bad cursor (e.g. an id that no longer exists) makes Prisma throw.
    // Answer with a clean 400 rather than a 500 carrying internals.
    console.error("[api] free-resources list failed:", err);
    return NextResponse.json({ error: "Could not load resources" }, { status: 400 });
  }
}
