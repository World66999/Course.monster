import type { Metadata } from "next";
import { Suspense } from "react";
import { listCourses, getAllCategories, getCourseLanguages } from "@/lib/courses";
import { listCoursesQuerySchema } from "@/lib/validation";
import { db } from "@/lib/db";
import { absoluteUrl } from "@/lib/utils";
import { PageHeader, Section } from "@/components/site/section";
import { FiltersBar } from "@/components/site/filters-bar";
import { InfiniteCourseList } from "@/components/site/course-list";
import { CourseGridSkeleton } from "@/components/ui/skeleton";
import { CommunityLinks } from "@/components/site/community-links";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { category: categorySlug } = await searchParams;
  const slug = Array.isArray(categorySlug) ? categorySlug[0] : categorySlug;

  const category = slug
    ? await db.category.findUnique({ where: { slug }, select: { name: true, description: true } })
    : null;

  const title = category ? `${category.name} Courses` : "All Courses";
  const description = category
    ? category.description || `Browse and download free ${category.name} courses.`
    : "Browse and download every free course — filter by category, search and sort.";
  const canonical = category ? `/courses?category=${slug}` : "/courses";

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: absoluteUrl(canonical) },
  };
}

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
  if (query.level) qs.set("level", query.level);
  if (query.lang) qs.set("lang", query.lang);
  if (query.duration) qs.set("duration", query.duration);
  if (query.flag) qs.set("flag", query.flag);
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
  const [categories, languages] = await Promise.all([getAllCategories(), getCourseLanguages()]);

  return (
    <Section className="py-12">
      <PageHeader
        eyebrow="Library"
        title="All courses"
        description={
          <>
            Every course is free to download. Filter, search and sort to find yours.
          </>
        }
      />

      <div className="mb-8 flex flex-col gap-3 rounded-card border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Want new courses as they land?</span>{" "}
          Follow our Telegram channel — free for everyone.
        </p>
        <CommunityLinks size="sm" className="shrink-0" />
      </div>

      <div className="mb-8">
        <Suspense>
          <FiltersBar
            categories={categories.map((c) => ({
              slug: c.slug,
              name: c.name,
              count: c._count.courses,
            }))}
            languages={languages}
          />
        </Suspense>
      </div>

      <Suspense fallback={<CourseGridSkeleton />}>
        <CourseResults searchParams={searchParams} />
      </Suspense>
    </Section>
  );
}
