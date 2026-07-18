import Link from "next/link";
import { Clock3, Download, Film, HardDrive } from "lucide-react";
import type { CourseCard as CourseCardData } from "@/lib/courses";
import { Badge } from "@/components/ui/badge";
import { CourseImage } from "@/components/site/course-image";
import { formatNumber } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export function CourseCard({ course, priority = false }: { course: CourseCardData; priority?: boolean }) {
  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10"
    >
      <div className="relative aspect-video overflow-hidden bg-muted">
        <CourseImage
          src={course.thumbnail}
          title={course.title}
          priority={priority}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute top-3 left-3 flex gap-1.5">
          {course.featured && <Badge className="glass border-0 text-white">Featured</Badge>}
          {course.trending && (
            <Badge variant="warning" className="glass border-0">
              Trending
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {course.category && (
          <span className="text-xs font-medium tracking-wide text-primary uppercase">
            {course.category.name}
          </span>
        )}
        <h3 className="line-clamp-2 leading-snug font-semibold text-card-foreground group-hover:text-primary">
          {course.title}
        </h3>
        {course.shortDescription && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{course.shortDescription}</p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 text-xs text-muted-foreground">
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
