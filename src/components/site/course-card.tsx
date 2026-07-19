import Link from "next/link";
import { ArrowUpRight, BarChart3, Clock3, Download, Film, HardDrive, Timer } from "lucide-react";
import type { CourseCard as CourseCardData } from "@/lib/courses";
import { Badge } from "@/components/ui/badge";
import { CourseImage } from "@/components/site/course-image";
import { formatNumber } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const SKILL_LABELS: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

export function CourseCard({ course, priority = false }: { course: CourseCardData; priority?: boolean }) {
  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-elevated"
    >
      <div className="relative aspect-video overflow-hidden bg-muted">
        <CourseImage
          src={course.thumbnail}
          title={course.title}
          priority={priority}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
        <div className="absolute top-3 left-3 flex gap-1.5">
          {course.featured && <Badge className="glass border-0 text-white ring-white/20">Featured</Badge>}
          {course.trending && (
            <Badge variant="warning" className="glass border-0 ring-white/20">
              Trending
            </Badge>
          )}
        </div>
        <span
          aria-hidden
          className="absolute right-3 bottom-3 flex h-8 w-8 translate-y-1 items-center justify-center rounded-full bg-white/90 text-slate-900 opacity-0 shadow-md transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
        >
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {(course.category || course.skillLevel) && (
          <span className="flex items-center justify-between gap-2">
            {course.category && (
              <span className="text-xs font-semibold tracking-wider text-primary uppercase">
                {course.category.name}
              </span>
            )}
            {course.skillLevel && (
              <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                <BarChart3 className="h-3.5 w-3.5" aria-hidden />
                {SKILL_LABELS[course.skillLevel]}
              </span>
            )}
          </span>
        )}
        <h3 className="line-clamp-2 leading-snug font-semibold text-card-foreground transition-colors duration-200 group-hover:text-primary">
          {course.title}
        </h3>
        {course.shortDescription && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{course.shortDescription}</p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          {course.durationHours != null && course.durationHours > 0 && (
            <span className="inline-flex items-center gap-1">
              <Timer className="h-3.5 w-3.5" aria-hidden />
              {Math.round(course.durationHours * 10) / 10}h
            </span>
          )}
          {course.lecturesCount != null && course.lecturesCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Film className="h-3.5 w-3.5" aria-hidden />
              {course.lecturesCount} lectures
            </span>
          )}
          {course.sizeLabel && (
            <span className="inline-flex items-center gap-1">
              <HardDrive className="h-3.5 w-3.5" aria-hidden />
              {course.sizeLabel}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Download className="h-3.5 w-3.5" aria-hidden />
            {formatNumber(course.downloads)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" aria-hidden />
            {formatDistanceToNow(course.contentUpdatedAt, { addSuffix: true })}
          </span>
        </div>
      </div>
    </Link>
  );
}
