import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listChatMessages, listRemovedMessageIds, toChatMessagesResponse } from "@/lib/chat";
import { listChatMessagesQuerySchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/ip";

export async function GET(request: NextRequest) {
  const ip = await getClientIp();
  const rl = checkRateLimit(`api-chat-messages:${hashIp(ip)}`, { limit: 120, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = listChatMessagesQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;

  // Stamped before any query runs, and handed back to the client as
  // `serverTime`. A message moderated while these queries are in flight then
  // lands inside the *next* poll's window rather than being missed by both.
  const requestedAt = new Date();

  const { items, nextCursor } = await listChatMessages(parsed.data);
  const payload = await toChatMessagesResponse(items, nextCursor, userId, requestedAt);

  if (parsed.data.since) {
    payload.removedIds = await listRemovedMessageIds(parsed.data.since);
  }

  // A live feed — always fresh, never a shared/public cache.
  return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
}
