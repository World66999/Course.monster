import { NextRequest, NextResponse } from "next/server";
import { listAiPlatforms } from "@/lib/ai-platforms";
import { listAiPlatformsQuerySchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/ip";

/** Read-only pagination endpoint for the Free AI Platforms grid. */
export async function GET(request: NextRequest) {
  const ip = await getClientIp();
  const rl = checkRateLimit(`api-ai-platforms:${hashIp(ip)}`, { limit: 120, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = listAiPlatformsQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  try {
    const { items, nextCursor, total } = await listAiPlatforms(parsed.data);
    return NextResponse.json(
      { items, nextCursor, total },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch (err) {
    console.error("[api] ai-platforms list failed:", err);
    return NextResponse.json({ error: "Could not load platforms" }, { status: 400 });
  }
}
