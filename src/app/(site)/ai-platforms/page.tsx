import type { Metadata } from "next";
import { Suspense } from "react";
import { Info } from "lucide-react";
import { listAiPlatforms } from "@/lib/ai-platforms";
import { listAiPlatformsQuerySchema } from "@/lib/validation";
import { absoluteUrl } from "@/lib/utils";
import { PageHeader, Section } from "@/components/site/section";
import { AiFiltersBar } from "@/components/site/ai-platforms/ai-filters-bar";
import { InfiniteAiPlatformList } from "@/components/site/ai-platforms/ai-platform-list";
import { DirectoryGridSkeleton } from "@/components/ui/skeleton";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Free AI Platforms — AI Tools Students Can Use Free",
  description:
    "A curated list of AI platforms students can use at no cost, each labelled with exactly how it is free — fully free, free tier, free plan with limits, or free trial — and linking to the official website.",
  alternates: { canonical: "/ai-platforms" },
  openGraph: {
    title: "Free AI Platforms — Courses Monster",
    description: "AI tools students can use free, with the free-access terms stated plainly.",
    url: absoluteUrl("/ai-platforms"),
  },
};

async function AiResults({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const parsed = listAiPlatformsQuerySchema.safeParse(flat);
  const query = parsed.success ? parsed.data : listAiPlatformsQuerySchema.parse({});

  const { items, nextCursor, total } = await listAiPlatforms(query);

  const qs = new URLSearchParams();
  if (query.q) qs.set("q", query.q);
  if (query.category) qs.set("category", query.category);
  if (query.pricing) qs.set("pricing", query.pricing);
  if (query.tag) qs.set("tag", query.tag);
  if (query.flag) qs.set("flag", query.flag);
  if (query.sort !== "curated") qs.set("sort", query.sort);

  return (
    <>
      <AiFiltersBar />
      <div className="mt-8">
        <InfiniteAiPlatformList
          initialItems={items}
          initialCursor={nextCursor}
          total={total}
          queryString={qs.toString()}
        />
      </div>
    </>
  );
}

export default function AiPlatformsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Section className="py-12">
      <PageHeader
        eyebrow="Directory"
        title="Free AI Platforms"
        description="AI tools you can use as a student without paying. Each entry says exactly how it is free and links straight to the platform's official website."
      />
      {/*
        Stated once, prominently, instead of hedging on every card. Vendors
        change their free tiers without notice and this site cannot verify a
        future price, so the honest thing is to date the claim and tell people
        to confirm at the source.
      */}
      <p className="mb-8 flex max-w-2xl items-start gap-1.5 rounded-control bg-muted px-3 py-2 text-xs text-muted-foreground ring-1 ring-inset ring-border">
        <Info className="mt-px h-3.5 w-3.5 shrink-0 text-info" aria-hidden />
        <span>
          Free plans change often. Each badge describes the offer as we last checked it — always confirm the
          current terms on the platform&apos;s own pricing page before you rely on it.
        </span>
      </p>
      <Suspense fallback={<DirectoryGridSkeleton />}>
        <AiResults searchParams={searchParams} />
      </Suspense>
    </Section>
  );
}
