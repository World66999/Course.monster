import type { Metadata } from "next";
import { Suspense } from "react";
import { listAppListings } from "@/lib/apps";
import { listAppListingsQuerySchema } from "@/lib/validation";
import { absoluteUrl } from "@/lib/utils";
import { PageHeader, Section } from "@/components/site/section";
import { AppFiltersBar } from "@/components/site/apps/app-filters-bar";
import { InfiniteAppList } from "@/components/site/apps/app-list";
import { AppGridSkeleton } from "@/components/ui/skeleton";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Apps Hub — Curated Free & Open-Source Software",
  description: "A professional directory of legitimate free, open-source and official software — never cracked or pirated.",
  alternates: { canonical: "/apps" },
  openGraph: {
    title: "Apps Hub — Courses Monster",
    description: "A curated directory of legitimate free and open-source software.",
    url: absoluteUrl("/apps"),
  },
};

async function AppResults({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const parsed = listAppListingsQuerySchema.safeParse(flat);
  const query = parsed.success ? parsed.data : listAppListingsQuerySchema.parse({});

  const { items, nextCursor, total } = await listAppListings(query);

  const qs = new URLSearchParams();
  if (query.q) qs.set("q", query.q);
  if (query.category) qs.set("category", query.category);
  if (query.platform) qs.set("platform", query.platform);
  if (query.openSource) qs.set("openSource", "true");
  if (query.flag) qs.set("flag", query.flag);
  if (query.sort !== "newest") qs.set("sort", query.sort);

  return (
    <>
      <AppFiltersBar />
      <div className="mt-8">
        <InfiniteAppList initialItems={items} initialCursor={nextCursor} total={total} queryString={qs.toString()} />
      </div>
    </>
  );
}

export default function AppsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Section className="py-12">
      <PageHeader
        eyebrow="Directory"
        title="Apps Hub"
        description={
          <>
            A curated directory of legitimate free, open-source and official software. Every listing links to its
          official source — nothing here is cracked, pirated or hosted by us.
          </>
        }
      />
      <Suspense fallback={<AppGridSkeleton />}>
        <AppResults searchParams={searchParams} />
      </Suspense>
    </Section>
  );
}
