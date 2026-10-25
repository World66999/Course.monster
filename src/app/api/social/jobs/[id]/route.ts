import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  cancelRemoteJob, fetchRemoteJob, safeMessage, safeWarning, STALE_JOB_MS } from "@/lib/social-download";
import { SocialJobStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Every state this route may report, and the subset that means "stop asking".
 *
 * The remote status used to be cast straight to the Prisma enum and handed to
 * the browser. Anything the service reported that this schema does not know
 * failed the database write silently (the update is `.catch`ed) and then
 * reached the poller as a status it does not recognise as terminal, so the tab
 * kept asking every two seconds until its own deadline. A value that is not one
 * of ours is now treated as "still working", which is the honest reading.
 */
const TERMINAL: ReadonlySet<SocialJobStatus> = new Set([
  SocialJobStatus.COMPLETED,
  SocialJobStatus.FAILED,
  SocialJobStatus.EXPIRED,
  SocialJobStatus.CANCELLED,
]);

function knownStatus(value: unknown): SocialJobStatus | null {
  return typeof value === "string" && value in SocialJobStatus ? (value as SocialJobStatus) : null;
}

/**
 * The browser polls this every two seconds for the life of a job, and each poll
 * that is not answered from our own row becomes a request to the internal
 * downloader. Without a ceiling one signed-in account can turn that into an
 * amplifier against a service that is deliberately not reachable any other way.
 * Set well above what an honest client needs: two concurrent jobs at 0.5 Hz is
 * 60 polls a minute, and this allows five times that.
 */
const POLL_LIMIT = { limit: 300, windowMs: 60_000 } as const;

/** Job status. Ownership is enforced by the query, not by the id being opaque. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = checkRateLimit(`social:poll:${userId}`, POLL_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const { id } = await params;
  const job = await db.socialDownloadJob.findFirst({ where: { id, userId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Terminal states are answered from our own row — no need to ask the service.
  // EXPIRED and CANCELLED belong here as much as COMPLETED and FAILED do: they
  // are settled, and leaving them out meant a cancelled job kept calling the
  // downloader on every poll to be told again that it was cancelled.
  if (TERMINAL.has(job.status)) {
    return NextResponse.json({
      id: job.id, status: job.status, platform: job.platform, title: job.title,
      fileName: job.fileName, fileSize: job.fileSize,
      error: job.errorCode ? safeMessage(job.errorCode) : null,
      percent: job.status === "COMPLETED" ? 100 : null,
    });
  }

  const remote = await fetchRemoteJob(job.remoteId, userId);
  if (!remote.ok) {
    // NOT_FOUND is conclusive: the service registers a job before returning its
    // id, so if it no longer knows the job it was restarted or has swept it, and
    // this job can never finish. Left alone the row stayed QUEUED forever — the
    // browser polled indefinitely and the admin panel counted it as in flight.
    // UNAVAILABLE is different: the service is merely unreachable right now and
    // may come back holding the job — but only for as long as the job could
    // still plausibly be running. Past that the row is settled here too, on the
    // same rule the create route already applies, because otherwise an
    // unreachable service left the row non-terminal for ever: the browser
    // polled every 2s with no end, the member kept burning one of their two
    // concurrent slots, and the admin panel counted a ghost as in flight.
    const stale = Date.now() - job.createdAt.getTime() > STALE_JOB_MS;
    if (remote.code === "NOT_FOUND" || stale) {
      await db.socialDownloadJob.update({
        where: { id: job.id },
        data: { status: "EXPIRED", errorCode: "UNAVAILABLE", completedAt: new Date() },
      }).catch(() => undefined);
      return NextResponse.json({
        id: job.id,
        status: "EXPIRED",
        percent: null,
        error: safeMessage("UNAVAILABLE"),
      });
    }
    return NextResponse.json({ id: job.id, status: job.status, percent: null, error: null });
  }

  // An unrecognised status is never written and never forwarded: the row keeps
  // whatever it had, and the client is told the job is still in flight.
  const status = knownStatus(remote.data.status) ?? job.status;
  if (knownStatus(remote.data.status) === null) {
    console.warn(`[social] job ${job.id}: downloader reported an unknown status, treating it as ${job.status}`);
  }
  if (status !== job.status) {
    await db.socialDownloadJob.update({
      where: { id: job.id },
      data: {
        status,
        title: remote.data.title ?? undefined,
        fileName: remote.data.fileName ?? undefined,
        // `?? 0` would reset a size the row already knew whenever the service
        // omitted it; leave the stored value alone instead.
        fileSize: typeof remote.data.fileSize === "number" ? remote.data.fileSize : undefined,
        errorCode: remote.data.errorCode ?? undefined,
        completedAt: TERMINAL.has(status) ? new Date() : undefined,
      },
    }).catch((err) => console.error(`[social] failed to record job ${job.id} as ${status}:`, err));
  }

  return NextResponse.json({
    id: job.id,
    status,
    platform: job.platform,
    phase: remote.data.phase,
    percent: remote.data.percent,
    title: remote.data.title,
    fileName: remote.data.fileName,
    fileSize: remote.data.fileSize,
    error: remote.data.errorCode ? safeMessage(remote.data.errorCode) : null,
    // Only present on the live-remote read, which is the poll that carries a
    // job into COMPLETED — the terminal branch above answers from our own row
    // and the note is deliberately not persisted (it would need a migration to
    // record something that only matters at the moment of delivery).
    // `job.platform` is our own stored value, not the caller's — the note can
    // differ per platform (Facebook withholds audio from this server rather
    // than lacking it), so the copy has to know which one it is talking about.
    warning: safeWarning(remote.data.warning, job.platform),
  });
}

/**
 * Cancel a job the caller owns.
 *
 * The engine has supported cancellation all along (POST /jobs/{id}/cancel, and
 * `cancelRemoteJob` here), but it was only reachable from the admin panel — a
 * user who started a long download had no way to stop it and simply held one of
 * the two website workers until it finished or timed out.
 *
 * Ownership comes from the same `where: { id, userId }` query the GET uses, so
 * an id belonging to somebody else is a 404 rather than a cancellation. The
 * remote call is made with the job's own owner id, never the caller's, so the
 * service applies its own ownership check to the same identity it was given at
 * creation.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Cancellation also reaches the internal service, so it is bounded as well —
  // more tightly, since no honest client cancels more than a handful of times.
  const rl = checkRateLimit(`social:cancel:${userId}`, { limit: 20, windowMs: 5 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many cancellation requests." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const { id } = await params;
  const job = await db.socialDownloadJob.findFirst({
    where: { id, userId },
    select: { id: true, remoteId: true, userId: true, status: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Already finished is not an error worth surfacing as a failure — the user's
  // intent (this job should not still be running) is satisfied either way.
  if (job.status !== "QUEUED" && job.status !== "PROCESSING") {
    return NextResponse.json({ id: job.id, status: job.status, cancelled: false });
  }

  const cancelled = await cancelRemoteJob(job.remoteId, job.userId);
  if (!cancelled) {
    return NextResponse.json(
      { error: "The downloader didn't accept the cancellation. Please try again." },
      { status: 502 }
    );
  }

  await db.socialDownloadJob.update({
    where: { id: job.id },
    data: { status: "CANCELLED", completedAt: new Date() },
  }).catch(() => undefined);

  return NextResponse.json({ id: job.id, status: "CANCELLED", cancelled: true });
}
