import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fetchRemoteJob, safeMessage } from "@/lib/social-download";
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
  });
}
