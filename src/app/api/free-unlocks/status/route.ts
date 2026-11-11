import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/ip";
import { DEVICE_COOKIE, deviceSubject, getFreeConfig, getFreeStatus, userSubject } from "@/lib/free-unlocks";
import { isValidDeviceId, nextIstMidnight } from "@/lib/shortener-core";
import { getViewer, jsonNoStore } from "@/server/premium-guard";

export const dynamic = "force-dynamic";

/**
 * Today's free-unlock count for whoever is looking, for the counter chip shown
 * around the site ("2 of 3 free unlocks left today").
 *
 * Strictly read-only and display-only. It never creates a device ID, never
 * writes a quota row and grants nothing: the limit is enforced where it always
 * was, in /api/download/init and /unlock/[token]. A browser that has not
 * visited a download page yet has no device cookie, so it simply reads as
 * "nothing used today" without a database lookup.
 *
 * Bot users are counted against their Telegram id, which this endpoint cannot
 * know outside a bot hand-off link; the download page itself shows their exact
 * count, exactly as before.
 */
export async function GET() {
  const ipHash = hashIp(await getClientIp());
  if (!checkRateLimit(`free-status:${ipHash}`, { limit: 60, windowMs: 60_000 }).ok) {
    return jsonNoStore({ error: "Too many requests" }, { status: 429 });
  }

  const viewer = await getViewer();
  if (viewer?.premium) return jsonNoStore({ premium: true });

  const now = new Date();
  const deviceCookie = (await cookies()).get(DEVICE_COOKIE)?.value;
  const subject = viewer
    ? userSubject(viewer.id)
    : isValidDeviceId(deviceCookie)
      ? deviceSubject(deviceCookie)
      : null;

  if (!subject) {
    const { limit } = await getFreeConfig();
    return jsonNoStore({ premium: false, used: 0, limit, resetsAt: nextIstMidnight(now).toISOString() });
  }

  const status = await getFreeStatus(subject, null, now, null);
  return jsonNoStore({
    premium: false,
    used: Math.min(status.used, status.limit),
    limit: status.limit,
    resetsAt: status.resetsAt.toISOString(),
  });
}
