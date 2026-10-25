import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePremiumViewer, jsonNoStore } from "@/server/premium-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { isActiveUntil } from "@/lib/premium";

/**
 * Members-only room feed. Premium (or staff) only, checked per request.
 * `after` (ISO time) turns it into a cheap incremental poll.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePremiumViewer();
  if ("response" in gate) return gate.response;
  const { viewer } = gate;
  if (!checkRateLimit(`pchat-poll:${viewer.id}`, { limit: 90, windowMs: 60_000 }).ok) {
    return jsonNoStore({ error: "Too many requests" }, { status: 429 });
  }
  const { id } = await params;
  if (!z.string().cuid().safeParse(id).success) return jsonNoStore({ error: "Not found" }, { status: 404 });
  const chat = await db.premiumChat.findFirst({
    where: { id, published: true, kind: "WEB_ROOM" },
    select: { id: true },
  });
  if (!chat) return jsonNoStore({ error: "Not found" }, { status: 404 });

  const afterRaw = request.nextUrl.searchParams.get("after");
  const after = afterRaw && !Number.isNaN(Date.parse(afterRaw)) ? new Date(afterRaw) : null;

  const rows = await db.premiumChatMessage.findMany({
    where: { chatId: id, deletedAt: null, ...(after ? { createdAt: { gt: after } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      body: true,
      createdAt: true,
      userId: true,
      user: { select: { name: true, chatDisplayName: true, image: true, premiumUntil: true, role: true } },
    },
  });

  return jsonNoStore({
    me: {
      id: viewer.id,
      banned: viewer.premiumChatBanned,
      mutedUntil:
        viewer.premiumChatMutedUntil && viewer.premiumChatMutedUntil.getTime() > Date.now()
          ? viewer.premiumChatMutedUntil.toISOString()
          : null,
      staff: viewer.role !== "USER",
    },
    messages: rows.reverse().map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      mine: m.userId === viewer.id,
      author: {
        name: m.user.chatDisplayName ?? m.user.name,
        image: m.user.image,
        premium: isActiveUntil(m.user.premiumUntil),
        staff: m.user.role !== "USER",
      },
    })),
  });
}
