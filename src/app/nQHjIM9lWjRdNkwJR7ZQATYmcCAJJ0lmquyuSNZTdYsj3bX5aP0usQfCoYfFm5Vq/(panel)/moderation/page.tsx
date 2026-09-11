import type { Metadata } from "next";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { adminPath } from "@/lib/admin-path";
import { cn } from "@/lib/utils";
import { ModerationCommentsTable } from "@/components/admin/moderation-comments-table";
import { ModerationReviewsTable } from "@/components/admin/moderation-reviews-table";
import { ModerationReportsTable, type ModerationReportRow } from "@/components/admin/moderation-reports-table";

export const metadata: Metadata = { title: "Moderation" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const TABS = [
  { value: "reports", label: "Reports" },
  { value: "comments", label: "Comments" },
  { value: "reviews", label: "Reviews" },
] as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function ModerationPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const tab = (first(raw.tab) || "reports") as (typeof TABS)[number]["value"];
  const q = first(raw.q);
  const status = first(raw.status);
  const reportStatus = first(raw.reportStatus) || "OPEN";
  const page = Math.max(1, Number(first(raw.page)) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading">Moderation</h1>
        <p className="mt-1 text-sm text-muted-foreground">Reviews, comments and user reports.</p>
      </div>

      <div className="flex w-fit gap-1 rounded-nested bg-muted p-1">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`${adminPath("moderation")}?tab=${t.value}`}
            className={cn(
              "rounded-control px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t.value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "comments" && (
        <CommentsTab q={q} status={status} page={page} skip={skip} />
      )}
      {tab === "reviews" && <ReviewsTab q={q} status={status} page={page} skip={skip} />}
      {tab === "reports" && <ReportsTab status={reportStatus} page={page} skip={skip} />}
    </div>
  );
}

async function CommentsTab({
  q,
  status,
  page,
  skip,
}: {
  q: string;
  status: string;
  page: number;
  skip: number;
}) {
  const where: Prisma.CommentWhereInput = {
    ...(q ? { body: { contains: q, mode: "insensitive" } } : {}),
    ...(status ? { status: status as "VISIBLE" | "HIDDEN" | "DELETED" } : {}),
  };
  const [total, comments] = await Promise.all([
    db.comment.count({ where }),
    db.comment.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
        course: { select: { title: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
  ]);

  return (
    <ModerationCommentsTable
      rows={comments.map((c) => ({
        id: c.id,
        body: c.body,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
        author: { name: c.user.name, email: c.user.email },
        course: c.course,
      }))}
      page={page}
      pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
    />
  );
}

async function ReviewsTab({
  q,
  status,
  page,
  skip,
}: {
  q: string;
  status: string;
  page: number;
  skip: number;
}) {
  const where: Prisma.ReviewWhereInput = {
    ...(q
      ? { OR: [{ body: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }] }
      : {}),
    ...(status ? { status: status as "VISIBLE" | "HIDDEN" | "DELETED" } : {}),
  };
  const [total, reviews] = await Promise.all([
    db.review.count({ where }),
    db.review.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
        course: { select: { title: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
  ]);

  return (
    <ModerationReviewsTable
      rows={reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        author: { name: r.user.name, email: r.user.email },
        course: r.course,
      }))}
      page={page}
      pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
    />
  );
}

async function ReportsTab({ status, page, skip }: { status: string; page: number; skip: number }) {
  const where: Prisma.ReportWhereInput = status
    ? { status: status as "OPEN" | "RESOLVED" | "DISMISSED" }
    : {};
  const [total, reports] = await Promise.all([
    db.report.count({ where }),
    db.report.findMany({
      where,
      include: {
        reporter: { select: { name: true } },
        comment: { select: { body: true } },
        review: { select: { title: true, body: true } },
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
    targetKind: r.commentId ? "comment" : "review",
    targetPreview: r.comment?.body ?? r.review?.title ?? r.review?.body ?? "(content removed)",
  }));

  return (
    <ModerationReportsTable rows={rows} page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} />
  );
}
