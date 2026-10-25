import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isActiveUntil } from "@/lib/premium";
import { isStaff } from "@/lib/roles";

/**
 * Request-time viewer lookup for premium API routes.
 *
 * The session only says *who* is asking. Whether they are Premium, disabled or
 * staff is read from the database on every call, so nothing cached in the JWT
 * (which lives for 12h) can keep a lapsed or revoked account unlocked.
 */

export interface Viewer {
  id: string;
  role: "ADMIN" | "EDITOR" | "USER";
  premium: boolean;
  premiumUntil: Date | null;
  premiumChatBanned: boolean;
  premiumChatMutedUntil: Date | null;
  name: string;
  chatDisplayName: string | null;
  image: string | null;
}

export async function getViewer(): Promise<Viewer | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const row = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      role: true,
      disabled: true,
      premiumUntil: true,
      premiumChatBanned: true,
      premiumChatMutedUntil: true,
      name: true,
      chatDisplayName: true,
      image: true,
    },
  });
  if (!row || row.disabled) return null;
  return {
    id: row.id,
    role: row.role,
    // Staff can always see what they manage, so moderation works without a subscription.
    premium: isActiveUntil(row.premiumUntil) || isStaff(row.role),
    premiumUntil: row.premiumUntil,
    premiumChatBanned: row.premiumChatBanned,
    premiumChatMutedUntil: row.premiumChatMutedUntil,
    name: row.name,
    chatDisplayName: row.chatDisplayName,
    image: row.image,
  };
}

const NO_STORE = { "Cache-Control": "private, no-store", Vary: "Cookie" } as const;

export function jsonNoStore(body: unknown, init: ResponseInit = {}): NextResponse {
  return NextResponse.json(body, { ...init, headers: { ...NO_STORE, ...(init.headers ?? {}) } });
}

/** Resolves the viewer or the 401/403 response to send instead. */
export async function requirePremiumViewer(): Promise<{ viewer: Viewer } | { response: NextResponse }> {
  const viewer = await getViewer();
  if (!viewer) return { response: jsonNoStore({ error: "Sign in required", code: "auth" }, { status: 401 }) };
  if (!viewer.premium) {
    return { response: jsonNoStore({ error: "Premium required", code: "premium" }, { status: 403 }) };
  }
  return { viewer };
}
