import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listNotifications } from "@/lib/notifications";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/ip";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = await getClientIp();
  const rl = checkRateLimit(`api-notifications:${hashIp(ip)}`, { limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const cursor = request.nextUrl.searchParams.get("cursor");
  const data = await listNotifications(session.user.id, { cursor });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
