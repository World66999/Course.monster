import { NextRequest, NextResponse } from "next/server";
import { listAppListings } from "@/lib/apps";
import { listAppListingsQuerySchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/ip";

export async function GET(request: NextRequest) {
  const ip = await getClientIp();
  const rl = checkRateLimit(`api-apps:${hashIp(ip)}`, { limit: 120, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = listAppListingsQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const { items, nextCursor, total } = await listAppListings(parsed.data);
  return NextResponse.json(
    { items, nextCursor, total },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
  );
}
