import "server-only";
import { headers } from "next/headers";

/**
 * Explicit CSRF check for payment server actions, on top of the one Next.js
 * already applies to every server action (Origin must match the host). Kept
 * separate so a framework change can't silently drop it: a request whose
 * Origin is missing or names another site is refused.
 */
export async function isSameOrigin(): Promise<boolean> {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  const allowed = new Set<string>();
  const forwarded = h.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = h.get("host")?.trim();
  if (forwarded) allowed.add(forwarded.toLowerCase());
  if (host) allowed.add(host.toLowerCase());
  for (const configured of [process.env.AUTH_URL, process.env.NEXT_PUBLIC_SITE_URL]) {
    try {
      if (configured) allowed.add(new URL(configured).host.toLowerCase());
    } catch {
      // ignore a malformed setting
    }
  }
  return allowed.has(originHost);
}
