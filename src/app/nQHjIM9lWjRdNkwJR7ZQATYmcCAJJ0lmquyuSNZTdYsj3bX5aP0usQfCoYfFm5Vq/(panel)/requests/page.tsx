import type { Metadata } from "next";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { adminPath } from "@/lib/admin-path";
import { cn } from "@/lib/utils";
import { RequestModerationTable, type AdminRequestRow } from "@/components/admin/request-moderation-table";
import { RequestUsersTable, type RequestUserRow } from "@/components/admin/request-users-table";
import { ModerationReportsTable, type ModerationReportRow } from "@/components/admin/moderation-reports-table";

export const metadata: Metadata = { title: "Course Requests" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const TABS = [
  { value: "requests", label: "Requests" },
  { value: "reports", label: "Reports" },
  { value: "users", label: "Users" },
] as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function AdminCourseRequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const tab = (first(raw.tab) || "requests") as (typeof TABS)[number]["value"];
  const q = first(raw.q);
  const modStatus = first(raw.modStatus);
  const kind = first(raw.kind);
  const reportStatus = first(raw.reportStatus) || "OPEN";
  const uq = first(raw.uq);
  const page = Math.max(1, Number(first(raw.page)) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading">Course Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Moderate requests, review reports, and manage restricted users.
        </p>
      </div>

      <div className="flex w-fit flex-wrap gap-1 rounded-nested bg-muted p-1">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`${adminPath("requests")}?tab=${t.value}`}
            className={cn(
              "rounded-control px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t.value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "requests" && <RequestsTab q={q} modStatus={modStatus} kind={kind} page={page} skip={skip} />}
      {tab === "reports" && <ReportsTab status={reportStatus} page={page} skip={skip} />}
      {tab === "users" && <UsersTab q={uq} page={page} skip={skip} />}
    </div>
  );
}

async function RequestsTab({
  q,
  modStatus,
  kind,
  page,
  skip,
}: {
  q: string;
  modStatus: string;
  kind: string;
  page: number;
  skip: number;
}) {
  const where: Prisma.CourseRequestWhereInput = {
    ...(q
      ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { subject: { contains: q, mode: "insensitive" } }] }
      : {}),
    ...(modStatus ? { moderationStatus: modStatus as "VISIBLE" | "HIDDEN" | "DELETED" } : {}),
    ...(kind ? { kind: kind as "REQUEST" | "RECOMMENDATION" } : {}),
  };
  const [total, requests] = await Promise.all([
    db.courseRequest.count({ where }),
    db.courseRequest.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        imageThumbUrl: true,
        kind: true,
        status: true,
        moderationStatus: true,
        pinned: true,
        featured: true,
        commentsLocked: true,
        voteCount: true,
        commentCount: true,
        createdAt: true,
        anonymous: true,
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
  ]);

  const rows: AdminRequestRow[] = requests.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    imageThumbUrl: r.imageThumbUrl,
    kind: r.kind,
    status: r.status,
    moderationStatus: r.moderationStatus,
    pinned: r.pinned,
    featured: r.featured,
    commentsLocked: r.commentsLocked,
    voteCount: r.voteCount,
    commentCount: r.commentCount,
    createdAt: r.createdAt.toISOString(),
    author: { label: r.anonymous ? "Anonymous" : r.user.name },
  }));

  return <RequestModerationTable rows={rows} page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} />;
}

async function ReportsTab({ status, page, skip }: { status: string; page: number; skip: number }) {
  const where: Prisma.ReportWhereInput = {
    OR: [{ courseRequestId: { not: null } }, { requestCommentId: { not: null } }],
    ...(status ? { status: status as "OPEN" | "RESOLVED" | "DISMISSED" } : {}),
  };
  const [total, reports] = await Promise.all([
    db.report.count({ where }),
    db.report.findMany({
      where,
      include: {
        reporter: { select: { name: true } },
        courseRequest: { select: { title: true } },
        requestComment: { select: { body: true } },
      },
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
    targetKind: r.courseRequestId ? "courseRequest" : "requestComment",
    targetPreview: r.courseRequest?.title || r.requestComment?.body || "(removed)",
  }));

  return <ModerationReportsTable rows={rows} page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} />;
}

async function UsersTab({ q, page, skip }: { q: string; page: number; skip: number }) {
  const where: Prisma.UserWhereInput = {
    role: "USER",
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
  };
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      select: { id: true, name: true, role: true, requestBanned: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
  ]);

  const rows: RequestUserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    requestBanned: u.requestBanned,
    createdAt: u.createdAt.toISOString(),
  }));

  return <RequestUsersTable rows={rows} page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} />;
}
