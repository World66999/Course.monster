import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/ip";
import {
  createRemoteJob, detectPlatform, hashUrl, safeMessage, PLATFORMS, STALE_JOB_MS } from "@/lib/social-download";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Creates a social download job.
 *
 * Signed-in only: an open downloader on a public domain attracts automated
 * traffic, and an account gives per-user ownership and attributable limits.
 * IP limits are applied as well, because one account could otherwise script it.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Please sign in to use the downloader." }, { status: 401 });
  }

  const ipKey = hashIp(await getClientIp());
  const perUser = checkRateLimit(`social:user:${userId}`, { limit: 10, windowMs: 10 * 60_000 });
  if (!perUser.ok) {
    return NextResponse.json(
      { error: "You've started a lot of downloads. Please wait a few minutes." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(perUser.retryAfterMs / 1000)) } }
    );
  }
  const perIp = checkRateLimit(`social:ip:${ipKey}`, { limit: 20, windowMs: 10 * 60_000 });
  if (!perIp.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { url, platform, audioOnly } = (body ?? {}) as Record<string, unknown>;
  if (typeof url !== "string") {
    return NextResponse.json({ error: safeMessage("UNSUPPORTED_URL") }, { status: 400 });
  }

  // Detect server-side; the selector is a UX affordance, never the authority.
  const detected = detectPlatform(url);
  if (!detected) {
    return NextResponse.json({ error: safeMessage("UNSUPPORTED_URL") }, { status: 400 });
  }
  if (typeof platform === "string" && (PLATFORMS as readonly string[]).includes(platform) && platform !== detected) {
    return NextResponse.json(
      { error: `You selected ${platform}, but this looks like a ${detected} link.` },
      { status: 400 }
    );
  }

  // Retire this member's abandoned rows before counting. A row only reaches a
  // terminal state when something polls it, so closing the tab leaves a job at
  // PROCESSING indefinitely — and the guard below then reads those ghosts as
  // real work and locks the member out of their own downloader. Observed in
  // production: a row stuck PROCESSING for nearly three hours.
  await db.socialDownloadJob.updateMany({
    where: {
      userId,
      status: { in: ["QUEUED", "PROCESSING"] },
      createdAt: { lt: new Date(Date.now() - STALE_JOB_MS) },
    },
    data: { status: "EXPIRED", errorCode: "UNAVAILABLE", completedAt: new Date() },
  });

  // Two concurrent jobs per user keeps a single account from filling the queue.
  const active = await db.socialDownloadJob.count({
    where: { userId, status: { in: ["QUEUED", "PROCESSING"] } },
  });
  if (active >= 2) {
    return NextResponse.json(
      { error: "You already have downloads in progress. Please wait for them to finish." },
      { status: 429 }
    );
  }

  const remote = await createRemoteJob(url, userId, audioOnly === true);
  if (!remote.ok) {
    return NextResponse.json({ error: safeMessage(remote.code) }, { status: remote.code === "UNAVAILABLE" ? 503 : 400 });
  }

  const job = await db.socialDownloadJob.create({
    data: {
      remoteId: remote.data.id,
      userId,
      platform: detected,
      urlHash: hashUrl(url),   // the URL itself is never stored
      status: "PROCESSING",
    },
    select: { id: true, platform: true, status: true },
  });
  return NextResponse.json({ id: job.id, platform: job.platform, status: job.status }, { status: 201 });
}
