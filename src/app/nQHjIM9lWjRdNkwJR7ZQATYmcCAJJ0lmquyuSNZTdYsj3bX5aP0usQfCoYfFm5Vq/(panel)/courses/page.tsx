import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { buttonClasses } from "@/components/ui/button";
import { CoursesTable } from "@/components/admin/courses-table";
import { AdminSearch } from "@/components/admin/admin-search";
import { adminPath } from "@/lib/admin-path";

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
  const categorySlug = typeof raw.category === "string" ? raw.category.slice(0, 120) : "";
  const type = typeof raw.type === "string" ? raw.type : "";
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
    ...(categorySlug === "none" ? { categoryId: null } : categorySlug ? { category: { slug: categorySlug } } : {}),
    ...(type === "premium" ? { premium: true } : {}),
    ...(type === "free" ? { premium: false } : {}),
    ...(type === "featured" ? { featured: true } : {}),
    ...(type === "trending" ? { trending: true } : {}),
  };

  const [categories, total, courses] = await Promise.all([
    db.category.findMany({ select: { slug: true, name: true }, orderBy: [{ order: "asc" }, { name: "asc" }] }),
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
          <h1 className="text-heading">Courses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} course{total === 1 ? "" : "s"} total
          </p>
        </div>
        <Link prefetch={false} href={adminPath("courses/new")} className={buttonClasses("primary", "md")}>
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
        filters={[
          {
            key: "category",
            label: "Filter by category",
            options: [
              { value: "", label: "All categories" },
              { value: "none", label: "No category" },
              ...categories.map((c) => ({ value: c.slug, label: c.name })),
            ],
          },
          {
            key: "type",
            label: "Filter by type",
            options: [
              { value: "", label: "All types" },
              { value: "free", label: "Free" },
              { value: "premium", label: "Premium" },
              { value: "featured", label: "Featured" },
              { value: "trending", label: "Trending" },
            ],
          },
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
          premium: c.premium,
          downloads: c.downloads,
          views: c.views,
          updatedAt: c.updatedAt.toISOString(),
        }))}
        page={page}
        pageCount={pageCount}
        reorderEnabled={!q && !status && !categorySlug && !type}
      />
    </div>
  );
}
