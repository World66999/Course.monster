import type { Metadata } from "next";
import { CloudDownload } from "lucide-react";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/site/section";
import { SocialJobsTable, type JobRow } from "@/components/admin/social/social-jobs-table";
import { PLATFORMS } from "@/lib/social-download";

export const metadata: Metadata = { title: "Downloader jobs" };
export const dynamic = "force-dynamic";

export default async function SocialJobsPage() {
  const jobs = await db.socialDownloadJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true,
      platform: true,
      status: true,
      title: true,
      fileName: true,
      fileSize: true,
      errorCode: true,
      urlHash: true,
      createdAt: true,
      completedAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={<CloudDownload aria-hidden />}
        title="No downloads yet"
        description="Jobs submitted from the website downloader will appear here."
      />
    );
  }

  const rows: JobRow[] = jobs.map((j) => ({
    id: j.id,
    platform: j.platform,
    status: j.status,
    title: j.title,
    fileName: j.fileName,
    fileSize: j.fileSize,
    errorCode: j.errorCode,
    // A short prefix only: enough to correlate two jobs, useless for reversing.
    urlHashPrefix: j.urlHash.slice(0, 12),
    userName: j.user?.name ?? "Unknown",
    userEmail: j.user?.email ?? "—",
    createdAt: j.createdAt.toISOString(),
    completedAt: j.completedAt?.toISOString() ?? null,
  }));

  return <SocialJobsTable rows={rows} platforms={[...PLATFORMS]} />;
}
