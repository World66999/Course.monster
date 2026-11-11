import { CourseGridSkeleton, Skeleton } from "@/components/ui/skeleton";
import { Section } from "@/components/site/section";

/** Streaming skeleton for the course catalog while categories/filters load. */
export default function CoursesLoading() {
  return (
    <Section className="py-12">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="mt-3 h-5 w-80" />
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-10 flex-1 rounded-control" />
        <Skeleton className="h-10 rounded-control sm:w-48" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      <div className="mt-8">
        <CourseGridSkeleton />
      </div>
    </Section>
  );
}
