import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/ip";

const querySchema = z.object({ q: z.string().trim().min(1).max(60) });

/**
 * Mention-autocomplete search. Deliberately excludes staff — admins are
 * anonymized in chat (always shown as "Admin"), so they aren't a
 * meaningfully mentionable participant here.
 */
export async function GET(request: NextRequest) {
  const ip = await getClientIp();
  const rl = checkRateLimit(`api-chat-mention-search:${hashIp(ip)}`, { limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const parsed = querySchema.safeParse({ q: request.nextUrl.searchParams.get("q") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ items: [] }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const users = await db.user.findMany({
    where: {
      role: "USER",
      disabled: false,
      chatBanned: false,
      OR: [
        { chatDisplayName: { contains: parsed.data.q, mode: "insensitive" } },
        { name: { contains: parsed.data.q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, chatDisplayName: true },
    take: 8,
  });

  const items = users.map((u) => ({ id: u.id, label: u.chatDisplayName ?? u.name }));
  return NextResponse.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
}
