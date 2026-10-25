import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@/auth";
import { listLearningResources, attachMyResourceState, getResourceCategories } from "@/lib/learning-resources";
import { listLearningResourcesQuerySchema } from "@/lib/validation";
import { absoluteUrl } from "@/lib/utils";
import { PageHeader, Section } from "@/components/site/section";
import { ResourceFiltersBar } from "@/components/site/learn/resource-filters-bar";
import { InfiniteResourceList } from "@/components/site/learn/resource-list";
import { ResourceGridSkeleton } from "@/components/ui/skeleton";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Free Learning Hub — Curated Free Videos & Playlists",
  description: "High-quality free YouTube videos and playlists, hand-picked and organized by topic and skill level.",
  alternates: { canonical: "/learn" },
  openGraph: {
    title: "Free Learning Hub — Courses Monster",
    description: "High-quality free YouTube videos and playlists, hand-picked and organized by topic.",
    url: absoluteUrl("/learn"),
  },
};

async function ResourceResults({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const parsed = listLearningResourcesQuerySchema.safeParse(flat);
  const query = parsed.success ? parsed.data : listLearningResourcesQuerySchema.parse({});

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const [{ items, nextCursor, total }, categories] = await Promise.all([
    listLearningResources(query, userId),
    getResourceCategories(),
  ]);
  const myState = await attachMyResourceState(items, userId);
  const cards = items.map((item) => ({ ...item, bookmarkedByMe: myState.get(item.id)!.bookmarked }));

  const qs = new URLSearchParams();
  if (query.q) qs.set("q", query.q);
  if (query.category) qs.set("category", query.category);
  if (query.tag) qs.set("tag", query.tag);
  if (query.level) qs.set("level", query.level);
  if (query.lang) qs.set("lang", query.lang);
  if (query.type) qs.set("type", query.type);
  if (query.flag) qs.set("flag", query.flag);
  if (query.bookmarked) qs.set("bookmarked", "true");
  if (query.sort !== "newest") qs.set("sort", query.sort);

  return (
    <>
      <ResourceFiltersBar categories={categories.map((c) => ({ slug: c.slug, name: c.name }))} />
      <div className="mt-8">
        <InfiniteResourceList
          initialItems={cards}
          initialCursor={nextCursor}
          total={total}
          queryString={qs.toString()}
        />
      </div>
    </>
  );
}

export default function LearnPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Section className="py-12">
      <PageHeader
        eyebrow="Free learning"
        title="Free Learning Hub"
        description={
          <>
            Hand-picked free YouTube videos and playlists — filter by topic, difficulty and type to find exactly what
          you need.
          </>
        }
      />
      <Suspense fallback={<ResourceGridSkeleton />}>
        <ResourceResults searchParams={searchParams} />
      </Suspense>
    </Section>
  );
}
