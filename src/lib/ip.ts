import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/**
 * Resolve the client IP. Behind Nginx (production) the real IP arrives in
 * X-Forwarded-For / X-Real-IP, which Nginx is configured to set — see
 * deploy/nginx.conf. Values are only trustworthy when the proxy overwrites
 * them, which our Nginx config does.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

/** Privacy-preserving IP hash for analytics/rate keys stored in the DB. */
export function hashIp(ip: string): string {
  const salt = process.env.DOWNLOAD_TOKEN_SECRET ?? "static-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}
