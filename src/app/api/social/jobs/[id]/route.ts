import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  cancelRemoteJob, fetchRemoteJob, safeMessage, safeWarning, STALE_JOB_MS } from "@/lib/social-download";
import type { SocialJobStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Job status. Ownership is enforced by the query, not by the id being opaque. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const job = await db.socialDownloadJob.findFirst({ where: { id, userId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Terminal states are answered from our own row — no need to ask the service.
  if (job.status === "COMPLETED" || job.status === "FAILED") {
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

  const status = remote.data.status as SocialJobStatus;
  if (status !== job.status) {
    await db.socialDownloadJob.update({
      where: { id: job.id },
      data: {
        status,
        title: remote.data.title ?? undefined,
        fileName: remote.data.fileName ?? undefined,
        fileSize: remote.data.fileSize ?? 0,
        errorCode: remote.data.errorCode ?? undefined,
        completedAt: status === "COMPLETED" || status === "FAILED" ? new Date() : undefined,
      },
    }).catch(() => undefined);
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
    warning: safeWarning(remote.data.warning),
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
