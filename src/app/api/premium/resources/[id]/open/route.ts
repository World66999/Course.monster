import { NextRequest, NextResponse } from "next/server";
import { z } from "@/lib/zod";
import { db } from "@/lib/db";
import { getViewer } from "@/server/premium-guard";
import { consumePremiumLinkToken } from "@/lib/premium-link-token";
import { isSafeExternalUrl } from "@/lib/safe-url";
import { siteOrigin } from "@/lib/ip";

/**
 * Redeems a 60-second, single-use, account-bound link token and redirects to
 * the resource's destination. Premium is re-checked here too, so a token minted
 * a moment before a revoke or expiry is still refused.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const locked = new URL("/premium-resources?locked=1", siteOrigin(request.nextUrl.origin));
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("t") ?? "";
  if (!z.string().cuid().safeParse(id).success || !token) return NextResponse.redirect(locked);

  const viewer = await getViewer();
  if (!viewer?.premium) return NextResponse.redirect(locked);
  if (!consumePremiumLinkToken(token, viewer.id, id)) return NextResponse.redirect(locked);

  const row = await db.premiumResource.findFirst({ where: { id, published: true }, select: { url: true } });
  if (!row?.url || !isSafeExternalUrl(row.url)) return NextResponse.redirect(locked);
  return NextResponse.redirect(row.url, {
    status: 302,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex" },
  });
}
