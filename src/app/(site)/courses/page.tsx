import type { Metadata } from "next";
import { Suspense } from "react";
import { listCourses, getAllCategories } from "@/lib/courses";
import { listCoursesQuerySchema } from "@/lib/validation";
import { Section } from "@/components/site/section";
import { FiltersBar } from "@/components/site/filters-bar";
import { InfiniteCourseList } from "@/components/site/course-list";
import { CourseGridSkeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "All Courses",
  description: "Browse and download every free course — filter by category, search and sort.",
  alternates: { canonical: "/courses" },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function CourseResults({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
  );
  const parsed = listCoursesQuerySchema.safeParse(flat);
  const query = parsed.success ? parsed.data : listCoursesQuerySchema.parse({});

  const { items, nextCursor, total } = await listCourses(query);

  const qs = new URLSearchParams();
  if (query.q) qs.set("q", query.q);
  if (query.category) qs.set("category", query.category);
  if (query.tag) qs.set("tag", query.tag);
  if (query.sort !== "newest") qs.set("sort", query.sort);

  return (
    <InfiniteCourseList
      key={qs.toString()}
      initialItems={items}
      initialCursor={nextCursor}
      total={total}
      queryString={qs.toString()}
    />
  );
}

export default async function CoursesPage({ searchParams }: { searchParams: SearchParams }) {
  const categories = await getAllCategories();

  return (
    <Section className="py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">All courses</h1>
        <p className="mt-2 text-muted-foreground">
          Every course is free to download. Filter, search and sort to find yours.
        </p>
      </div>

      <div className="mb-8">
        <Suspense>
          <FiltersBar
            categories={categories.map((c) => ({
              slug: c.slug,
              name: c.name,
              count: c._count.courses,
            }))}
          />
        </Suspense>
      </div>

      <Suspense fallback={<CourseGridSkeleton />}>
        <CourseResults searchParams={searchParams} />
      </Suspense>
    </Section>
  );
}
