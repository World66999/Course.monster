import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { auth } from "@/auth";
import { getSiteSettings } from "@/lib/settings";
import {
  listCourseRequests,
  attachMyRequestState,
  toRequestCard,
  getRequestCategories,
} from "@/lib/course-requests";
import { listCourseRequestsQuerySchema } from "@/lib/validation";
import { absoluteUrl } from "@/lib/utils";
import { PageHeader, Section } from "@/components/site/section";
import { RequestFiltersBar } from "@/components/site/requests/request-filters-bar";
import { InfiniteRequestList } from "@/components/site/requests/request-list";
import { RequestGridSkeleton } from "@/components/ui/skeleton";
import { buttonClasses } from "@/components/ui/button";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Course Requests — Ask, Vote, and Discover",
  description:
    "Request courses you want, share resources you recommend, and vote on what the community should add next.",
  alternates: { canonical: "/requests" },
  openGraph: {
    title: "Course Requests — Courses Monster",
    description: "Request courses, share resources, and vote on what to add next.",
    url: absoluteUrl("/requests"),
  },
};

async function RequestResults({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const parsed = listCourseRequestsQuerySchema.safeParse(flat);
  const query = parsed.success ? parsed.data : listCourseRequestsQuerySchema.parse({});

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const [settings, { items, nextCursor, total }] = await Promise.all([
    getSiteSettings(),
    listCourseRequests(query, userId),
  ]);
  const myState = await attachMyRequestState(items, userId);
  const cards = items.map((item) =>
    toRequestCard(item, {
      votedByMe: myState.get(item.id)!.voted,
      bookmarkedByMe: myState.get(item.id)!.bookmarked,
      followedByMe: myState.get(item.id)!.followed,
      currentUserId: userId,
      popularThreshold: settings.courseRequests.popularVoteThreshold,
    })
  );

  const qs = new URLSearchParams();
  if (query.q) qs.set("q", query.q);
  if (query.category) qs.set("category", query.category);
  if (query.tag) qs.set("tag", query.tag);
  if (query.level) qs.set("level", query.level);
  if (query.status) qs.set("status", query.status);
  if (query.kind) qs.set("kind", query.kind);
  if (query.sort !== "newest") qs.set("sort", query.sort);

  return (
    <InfiniteRequestList
      key={qs.toString()}
      initialItems={cards}
      initialCursor={nextCursor}
      total={total}
      queryString={qs.toString()}
    />
  );
}

export default async function RequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const categories = await getRequestCategories();

  return (
    <Section className="py-12">
      <PageHeader
        eyebrow="Community"
        title="Course Requests"
        description={
          <>
            Ask for a course you want, share a resource you recommend, and vote on what the community
            should add next.
          </>
        }
        actions={
          <>
        <Link href="/requests/new" className={buttonClasses("primary", "md")}>
          <PlusCircle className="h-4 w-4" aria-hidden />
          Request a course
        </Link>
          </>
        }
      />

      <div className="mb-8">
        <Suspense>
          <RequestFiltersBar categories={categories} />
        </Suspense>
      </div>

      <Suspense fallback={<RequestGridSkeleton />}>
        <RequestResults searchParams={searchParams} />
      </Suspense>
    </Section>
  );
}
