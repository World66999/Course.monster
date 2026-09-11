import type { Metadata } from "next";
import { db } from "@/lib/db";
import { CategoriesManager } from "@/components/admin/categories-manager";

export const metadata: Metadata = { title: "Categories" };
export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const categories = await db.category.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { courses: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading">Categories</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Organize courses into browsable categories.
        </p>
      </div>
      <CategoriesManager
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description ?? "",
          icon: c.icon ?? "",
          courseCount: c._count.courses,
        }))}
      />
    </div>
  );
}
