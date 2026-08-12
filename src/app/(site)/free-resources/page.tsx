import type { Metadata } from "next";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { listFreeResources, getFreeResourceTags } from "@/lib/free-resources";
import { listFreeResourcesQuerySchema } from "@/lib/validation";
import { absoluteUrl } from "@/lib/utils";
import { Section } from "@/components/site/section";
import { ResourceFiltersBar } from "@/components/site/free-resources/resource-filters-bar";
import { InfiniteResourceList } from "@/components/site/free-resources/resource-list";
import { DirectoryGridSkeleton } from "@/components/ui/skeleton";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * One canonical URL for the whole section. Filter combinations stay
 * out of the sitemap and share this canonical, so the directory cannot
 * spawn thousands of near-duplicate indexable URLs.
 */
export const metadata: Metadata = {
  title: "Free Resources — Curated Free Study Material & Links",
  description:
    "A hand-checked directory of free study resources: MEGA folders, Telegram channels, Google Drive links, GitHub repositories, documentation, ebooks and free tools. Every link opens at its original source.",
  alternates: { canonical: "/free-resources" },
  openGraph: {
    title: "Free Resources — Courses Monster",
    description: "Curated free study material and links, always at the original source.",
    url: absoluteUrl("/free-resources"),
  },
};

async function ResourceResults({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  // A malformed query must show the default listing, not an error page.
  const parsed = listFreeResourcesQuerySchema.safeParse(flat);
  const query = parsed.success ? parsed.data : listFreeResourcesQuerySchema.parse({});

  const [{ items, nextCursor, total }, tags] = await Promise.all([
    listFreeResources(query),
    getFreeResourceTags(),
  ]);

  // Rebuilt from the *parsed* query so only validated values reach /api.
  const qs = new URLSearchParams();
  if (query.q) qs.set("q", query.q);
  if (query.category) qs.set("category", query.category);
  if (query.source) qs.set("source", query.source);
  if (query.tag) qs.set("tag", query.tag);
  if (query.flag) qs.set("flag", query.flag);
  if (query.sort !== "curated") qs.set("sort", query.sort);

  return (
    <>
      <ResourceFiltersBar tags={tags} />
      <div className="mt-8">
        <InfiniteResourceList
          initialItems={items}
          initialCursor={nextCursor}
          total={total}
          queryString={qs.toString()}
        />
      </div>
    </>
  );
}

export default function FreeResourcesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Section className="py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Free Resources</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Useful free material from around the web — MEGA folders, Telegram channels, Drive links, GitHub
          repositories, documentation, ebooks and tools. We only link to them; nothing here is re-hosted,
          mirrored or proxied by Courses Monster.
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          Every link opens its original source in a new tab. Check the destination before downloading.
        </p>
      </div>
      {/* Suspense keeps the heading painted while the query runs, so the page
          never looks blank on a slow connection. */}
      <Suspense fallback={<DirectoryGridSkeleton />}>
        <ResourceResults searchParams={searchParams} />
      </Suspense>
    </Section>
  );
}
