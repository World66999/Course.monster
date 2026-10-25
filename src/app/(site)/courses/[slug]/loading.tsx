import { Skeleton } from "@/components/ui/skeleton";
import { Section } from "@/components/site/section";

/** Streaming skeleton for course detail pages, mirroring the real layout. */
export default function CourseLoading() {
  return (
    <>
      <Skeleton className="h-56 w-full rounded-none sm:h-72 lg:h-80" />
      <Section className="relative -mt-24 pb-16">
        <Skeleton className="mb-4 h-4 w-64" />
        <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
          <div>
            <Skeleton className="mb-3 h-6 w-40" />
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="mt-3 h-5 w-full max-w-xl" />
            <div className="mt-6 flex gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="mt-10 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
          <div>
            <Skeleton className="aspect-video w-full rounded-card" />
            <Skeleton className="mt-4 h-12 w-full rounded-control" />
            <Skeleton className="mt-3 h-12 w-full rounded-control" />
          </div>
        </div>
      </Section>
    </>
  );
}
