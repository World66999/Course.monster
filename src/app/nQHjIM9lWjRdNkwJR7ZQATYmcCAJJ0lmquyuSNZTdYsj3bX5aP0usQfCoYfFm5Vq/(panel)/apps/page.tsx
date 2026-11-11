import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { adminPath } from "@/lib/admin-path";
import { cn } from "@/lib/utils";
import { AppsTable, type AdminAppRow } from "@/components/admin/apps-table";
import { ModerationReportsTable, type ModerationReportRow } from "@/components/admin/moderation-reports-table";

export const metadata: Metadata = { title: "Apps Hub" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const TABS = [
  { value: "apps", label: "Apps" },
  { value: "reports", label: "Reports" },
] as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function AdminAppsPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const tab = (first(raw.tab) || "apps") as (typeof TABS)[number]["value"];
  const q = first(raw.q);
  const reportStatus = first(raw.reportStatus) || "OPEN";
  const page = Math.max(1, Number(first(raw.page)) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading">Apps Hub</h1>
        <p className="mt-1 text-sm text-muted-foreground">Curate the software directory. Link-out only — never host binaries.</p>
      </div>

      <div className="flex w-fit flex-wrap gap-1 rounded-nested bg-muted p-1">
        {TABS.map((t) => (
          <Link prefetch={false}
            key={t.value}
            href={`${adminPath("apps")}?tab=${t.value}`}
            className={cn(
              "rounded-control px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t.value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "apps" && <AppsTab q={q} page={page} skip={skip} />}
      {tab === "reports" && <ReportsTab status={reportStatus} page={page} skip={skip} />}
    </div>
  );
}

async function AppsTab({ q, page, skip }: { q: string; page: number; skip: number }) {
  const where: Prisma.AppListingWhereInput = q
    ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }] }
    : {};

  const [total, apps] = await Promise.all([
    db.appListing.count({ where }),
    db.appListing.findMany({
      where,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      skip,
      take: PAGE_SIZE,
    }),
  ]);

  const rows: AdminAppRow[] = apps.map((a) => ({
    id: a.id,
    name: a.name,
    slug: a.slug,
    icon: a.icon,
    platform: a.platform,
    published: a.published,
    featured: a.featured,
    views: a.views,
  }));

  return <AppsTable rows={rows} page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} />;
}

async function ReportsTab({ status, page, skip }: { status: string; page: number; skip: number }) {
  const where: Prisma.ReportWhereInput = {
    appListingId: { not: null },
    ...(status ? { status: status as "OPEN" | "RESOLVED" | "DISMISSED" } : {}),
  };
  const [total, reports] = await Promise.all([
    db.report.count({ where }),
    db.report.findMany({
      where,
      include: { reporter: { select: { name: true } }, appListing: { select: { name: true } } },
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
    targetKind: "appListing",
    targetPreview: r.appListing?.name || "(removed)",
  }));

  return <ModerationReportsTable rows={rows} page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} />;
}
