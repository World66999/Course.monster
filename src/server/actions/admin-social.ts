"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth-helpers";
import { logAudit } from "@/lib/audit";
import { adminPath } from "@/lib/admin-path";
import { cancelRemoteJob, retryRemoteJob, sweepRemote } from "@/lib/social-download";
import type { ActionResult } from "@/server/actions/courses";

/**
 * Social downloader administration.
 *
 * Gated by the same `requireAdmin()` as the rest of the panel — there is no
 * second authentication path for the downloader, and an ordinary website
 * account can never reach any of this even by calling the action directly.
 *
 * Every control here acts through the internal service using the *job owner's*
 * id, so the service's own ownership check still applies. An operator can act
 * on a job; an operator can never take one over.
 *
 * Nothing in this file returns a URL, a filesystem path, the internal secret or
 * any environment value: the site stores only a SHA-256 of each URL, and that
 * is deliberately not reversible.
 */

const idSchema = z.string().cuid();

function revalidate() {
  revalidatePath(adminPath("social-downloader"), "layout");
}

export async function cancelSocialJobAction(jobId: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = idSchema.safeParse(jobId);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const job = await db.socialDownloadJob.findUnique({
    where: { id: parsed.data },
    select: { id: true, remoteId: true, userId: true, status: true },
  });
  if (!job) return { ok: false, error: "That job no longer exists" };
  if (job.status !== "QUEUED" && job.status !== "PROCESSING") {
    return { ok: false, error: "That job has already finished" };
  }

  const cancelled = await cancelRemoteJob(job.remoteId, job.userId);
  if (!cancelled) return { ok: false, error: "The downloader didn't accept the cancellation" };

  await db.socialDownloadJob.update({
    where: { id: job.id },
    data: { status: "CANCELLED", completedAt: new Date() },
  });
  await logAudit({
    userId: admin.id,
    action: "social.job.cancel",
    entity: "socialDownloadJob",
    entityId: job.id,
  });
  revalidate();
  return { ok: true, id: job.id };
}

/**
 * Re-run a job.
 *
 * Only possible while the downloader still holds the original URL — the website
 * never stores it. Once the service has swept the job the URL is genuinely gone
 * and no retry is possible, which the UI states rather than hiding.
 */
export async function retrySocialJobAction(jobId: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = idSchema.safeParse(jobId);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const job = await db.socialDownloadJob.findUnique({
    where: { id: parsed.data },
    select: { id: true, remoteId: true, userId: true, platform: true, urlHash: true },
  });
  if (!job) return { ok: false, error: "That job no longer exists" };

  const result = await retryRemoteJob(job.remoteId, job.userId);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.code === "NOT_FOUND"
          ? "The downloader no longer holds this job, so it can't be retried. Ask the member to submit the link again."
          : "The downloader couldn't start a retry right now",
    };
  }

  const created = await db.socialDownloadJob.create({
    data: {
      remoteId: result.data.id,
      userId: job.userId,
      platform: job.platform,
      urlHash: job.urlHash,
      status: "QUEUED",
    },
    select: { id: true },
  });
  await logAudit({
    userId: admin.id,
    action: "social.job.retry",
    entity: "socialDownloadJob",
    entityId: created.id,
    meta: { retriedFrom: job.id },
  });
  revalidate();
  return { ok: true, id: created.id };
}

/** Ask the service to expire finished artefacts and delete orphan directories. */
export async function sweepSocialJobsAction(): Promise<ActionResult> {
  const admin = await requireAdmin();
  const result = await sweepRemote();
  if (!result.ok) return { ok: false, error: "The downloader is unreachable" };

  // Reconcile rows the browser stopped polling. A job is reconciled when the
  // member closes the tab and the service is later restarted: nothing is left
  // to notice it, so without this it would sit "in flight" indefinitely. The
  // service's own watchdog gives up after ten minutes and it retains finished
  // work for thirty, so an hour is comfortably past any live job.
  const staleBefore = new Date(Date.now() - 60 * 60 * 1000);
  const { count: reconciled } = await db.socialDownloadJob.updateMany({
    where: { status: { in: ["QUEUED", "PROCESSING"] }, createdAt: { lt: staleBefore } },
    data: { status: "EXPIRED", errorCode: "UNAVAILABLE", completedAt: new Date() },
  });

  await logAudit({
    userId: admin.id,
    action: "social.sweep",
    entity: "socialDownloadJob",
    meta: {
      service: (result.detail ?? {}) as Prisma.InputJsonValue,
      reconciledStaleJobs: reconciled,
    },
  });
  revalidate();
  return { ok: true };
}

/**
 * Prune old job rows.
 *
 * Bounded to a sane window so a mistyped value can never wipe the table, and
 * it only ever removes rows that have already reached a terminal state.
 */
export async function pruneSocialJobsAction(days: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z.number().int().min(7).max(365).safeParse(days);
  if (!parsed.success) return { ok: false, error: "Choose between 7 and 365 days" };

  const cutoff = new Date(Date.now() - parsed.data * 24 * 60 * 60 * 1000);
  const { count } = await db.socialDownloadJob.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      status: { in: ["COMPLETED", "FAILED", "EXPIRED", "CANCELLED"] },
    },
  });
  await logAudit({
    userId: admin.id,
    action: "social.prune",
    entity: "socialDownloadJob",
    meta: { days: parsed.data, removed: count },
  });
  revalidate();
  return { ok: true };
}
