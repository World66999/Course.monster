import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@/auth";
import { listCodingChannels, attachMyChannelState, getChannelTags } from "@/lib/coding-channels";
import { listCodingChannelsQuerySchema } from "@/lib/validation";
import { absoluteUrl } from "@/lib/utils";
import { PageHeader, Section } from "@/components/site/section";
import { ChannelFiltersBar } from "@/components/site/coding-channels/channel-filters-bar";
import { InfiniteChannelList } from "@/components/site/coding-channels/channel-list";
import { ChannelGridSkeleton } from "@/components/ui/skeleton";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Coding Channels — Curated Programming YouTube Channels",
  description: "A hand-picked directory of the best programming YouTube channels — filter by topic, language and skill level.",
  alternates: { canonical: "/coding-channels" },
  openGraph: {
    title: "Coding Channels — Courses Monster",
    description: "A hand-picked directory of the best programming YouTube channels.",
    url: absoluteUrl("/coding-channels"),
  },
};

async function ChannelResults({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const parsed = listCodingChannelsQuerySchema.safeParse(flat);
  const query = parsed.success ? parsed.data : listCodingChannelsQuerySchema.parse({});

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const [{ items, nextCursor, total }, tags] = await Promise.all([
    listCodingChannels(query, userId),
    getChannelTags(),
  ]);
  const myState = await attachMyChannelState(items, userId);
  const cards = items.map((item) => ({ ...item, bookmarkedByMe: myState.get(item.id)!.bookmarked }));

  const qs = new URLSearchParams();
  if (query.q) qs.set("q", query.q);
  if (query.tag) qs.set("tag", query.tag);
  if (query.level) qs.set("level", query.level);
  if (query.lang) qs.set("lang", query.lang);
  if (query.flag) qs.set("flag", query.flag);
  if (query.bookmarked) qs.set("bookmarked", "true");
  if (query.sort !== "newest") qs.set("sort", query.sort);

  return (
    <>
      <ChannelFiltersBar tags={tags} />
      <div className="mt-8">
        <InfiniteChannelList
          initialItems={cards}
          initialCursor={nextCursor}
          total={total}
          queryString={qs.toString()}
        />
      </div>
    </>
  );
}

export default function CodingChannelsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Section className="py-12">
      <PageHeader
        eyebrow="Free learning"
        title="Coding Channels"
        description={
          <>
            A professionally curated directory of programming YouTube channels — filter by topic, skill level and
          spoken language to find your next favorite creator.
          </>
        }
      />
      <Suspense fallback={<ChannelGridSkeleton />}>
        <ChannelResults searchParams={searchParams} />
      </Suspense>
    </Section>
  );
}
