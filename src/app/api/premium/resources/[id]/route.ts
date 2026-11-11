import { NextRequest } from "next/server";
import { z } from "@/lib/zod";
import { db } from "@/lib/db";
import { requirePremiumViewer, jsonNoStore } from "@/server/premium-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { createPremiumLinkToken } from "@/lib/premium-link-token";

/**
 * The locked half of a Premium Resource. This route is the only code path
 * that reads `content` or `url`, and it does so after the server-side Premium
 * check — public pages render title/summary only.
 */
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePremiumViewer();
  if ("response" in gate) return gate.response;
  const { viewer } = gate;
  if (!checkRateLimit(`premium-res:${viewer.id}`, { limit: 60, windowMs: 60_000 }).ok) {
    return jsonNoStore({ error: "Too many requests" }, { status: 429 });
  }
  const { id } = await params;
  if (!z.string().cuid().safeParse(id).success) return jsonNoStore({ error: "Not found" }, { status: 404 });
  const row = await db.premiumResource.findFirst({
    where: { id, published: true },
    select: { id: true, content: true, url: true },
  });
  if (!row) return jsonNoStore({ error: "Not found" }, { status: 404 });
  return jsonNoStore({
    id: row.id,
    content: row.content,
    openUrl: row.url
      ? `/api/premium/resources/${row.id}/open?t=${encodeURIComponent(createPremiumLinkToken(viewer.id, row.id))}`
      : null,
  });
}
