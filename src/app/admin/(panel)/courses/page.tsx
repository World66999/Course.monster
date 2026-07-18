import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { buttonClasses } from "@/components/ui/button";
import { CoursesTable } from "@/components/admin/courses-table";
import { AdminSearch } from "@/components/admin/admin-search";

export const metadata: Metadata = { title: "Courses" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const q = typeof raw.q === "string" ? raw.q.slice(0, 120) : "";
  const status = typeof raw.status === "string" ? raw.status : "";
  const page = Math.max(1, Number(typeof raw.page === "string" ? raw.page : 1) || 1);

  const where: Prisma.CourseWhereInput = {
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(status === "published" ? { published: true } : {}),
    ...(status === "draft" ? { published: false } : {}),
  };

  const [total, courses] = await Promise.all([
    db.course.count({ where }),
    db.course.findMany({
      where,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { category: { select: { name: true } } },
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Courses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} course{total === 1 ? "" : "s"} total
          </p>
        </div>
        <Link href="/admin/courses/new" className={buttonClasses("primary", "md")}>
          <Plus className="h-4 w-4" aria-hidden />
          New course
        </Link>
      </div>

      <AdminSearch
        placeholder="Search by title or slug…"
        statusOptions={[
          { value: "", label: "All statuses" },
          { value: "published", label: "Published" },
          { value: "draft", label: "Draft" },
        ]}
      />

      <CoursesTable
        courses={courses.map((c) => ({
          id: c.id,
          title: c.title,
          slug: c.slug,
          thumbnail: c.thumbnail,
          category: c.category?.name ?? null,
          published: c.published,
          featured: c.featured,
          trending: c.trending,
          downloads: c.downloads,
          views: c.views,
          updatedAt: c.updatedAt.toISOString(),
        }))}
        page={page}
        pageCount={pageCount}
        reorderEnabled={!q && !status}
      />
    </div>
  );
}
