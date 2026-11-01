import "server-only";
import { createHash } from "node:crypto";
import { checkRateLimit, type RateLimitOptions, type RateLimitResult } from "@/lib/rate-limit";
import { isValidDeviceId } from "@/lib/shortener-core";

/**
 * Burst limits for the anonymous download flow, per *visitor* rather than per
 * IP: a mobile carrier (Jio, Airtel) puts many people behind one IP, and a
 * plain per-IP limit sized for one person would lock them all out.
 *
 * Each visitor is IP + device cookie (see DEVICE_COOKIE in free-unlocks.ts)
 * and gets the normal limit. The IP as a whole gets IP_CEILING_FACTOR times
 * that, as a backstop against someone rotating cookies. A request without a
 * valid device cookie shares one bucket with every other cookie-less request
 * from that IP, so it gets no more than before.
 */
const IP_CEILING_FACTOR = 10;

export function checkVisitorRateLimit(
  name: string,
  ipKey: string,
  deviceCookie: string | undefined,
  opts: RateLimitOptions
): RateLimitResult {
  const ceiling = checkRateLimit(`${name}:ip:${ipKey}`, { ...opts, limit: opts.limit * IP_CEILING_FACTOR });
  if (!ceiling.ok) return ceiling;
  const device = isValidDeviceId(deviceCookie)
    ? createHash("sha256").update(deviceCookie).digest("hex").slice(0, 24)
    : "none";
  return checkRateLimit(`${name}:${ipKey}:${device}`, opts);
}
