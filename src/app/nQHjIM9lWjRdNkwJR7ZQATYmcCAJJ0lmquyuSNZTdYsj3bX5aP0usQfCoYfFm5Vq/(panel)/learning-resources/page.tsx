import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { adminPath } from "@/lib/admin-path";
import { cn } from "@/lib/utils";
import { LearningResourcesTable, type AdminResourceRow } from "@/components/admin/learning-resources-table";
import { ModerationReportsTable, type ModerationReportRow } from "@/components/admin/moderation-reports-table";

export const metadata: Metadata = { title: "Learning Resources" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const TABS = [
  { value: "resources", label: "Resources" },
  { value: "reports", label: "Reports" },
] as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function AdminLearningResourcesPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const tab = (first(raw.tab) || "resources") as (typeof TABS)[number]["value"];
  const q = first(raw.q);
  const reportStatus = first(raw.reportStatus) || "OPEN";
  const page = Math.max(1, Number(first(raw.page)) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading">Learning Resources</h1>
        <p className="mt-1 text-sm text-muted-foreground">Curate the free video/playlist library.</p>
      </div>

      <div className="flex w-fit flex-wrap gap-1 rounded-nested bg-muted p-1">
        {TABS.map((t) => (
          <Link prefetch={false}
            key={t.value}
            href={`${adminPath("learning-resources")}?tab=${t.value}`}
            className={cn(
              "rounded-control px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t.value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "resources" && <ResourcesTab q={q} page={page} skip={skip} />}
      {tab === "reports" && <ReportsTab status={reportStatus} page={page} skip={skip} />}
    </div>
  );
}

async function ResourcesTab({ q, page, skip }: { q: string; page: number; skip: number }) {
  const where: Prisma.LearningResourceWhereInput = q
    ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }] }
    : {};

  const [total, resources] = await Promise.all([
    db.learningResource.count({ where }),
    db.learningResource.findMany({
      where,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      skip,
      take: PAGE_SIZE,
    }),
  ]);

  const rows: AdminResourceRow[] = resources.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    videoId: r.videoId,
    thumbnail: r.thumbnail,
    resourceType: r.resourceType,
    published: r.published,
    featured: r.featured,
    bookmarkCount: r.bookmarkCount,
    views: r.views,
  }));

  return <LearningResourcesTable rows={rows} page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} />;
}

async function ReportsTab({ status, page, skip }: { status: string; page: number; skip: number }) {
  const where: Prisma.ReportWhereInput = {
    learningResourceId: { not: null },
    ...(status ? { status: status as "OPEN" | "RESOLVED" | "DISMISSED" } : {}),
  };
  const [total, reports] = await Promise.all([
    db.report.count({ where }),
    db.report.findMany({
      where,
      include: { reporter: { select: { name: true } }, learningResource: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
  ]);

  const rows: ModerationReportRow[] = reports.map((r) => ({
    id: r.id,
    reason: r.reason,
    note: r.note,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    reporter: { name: r.reporter.name },
    targetKind: "learningResource",
    targetPreview: r.learningResource?.title || "(removed)",
  }));

  return <ModerationReportsTable rows={rows} page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} />;
}
