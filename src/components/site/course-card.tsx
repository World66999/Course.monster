import * as React from "react";
import Link from "next/link";
import { Crown, Download, Film, HardDrive, Sparkles, Timer, TrendingUp } from "lucide-react";
import type { CourseCard as CourseCardData } from "@/lib/courses";
import { Badge } from "@/components/ui/badge";
import { CourseImage } from "@/components/site/course-image";
import { SaveButton } from "@/components/site/save-button";
import { cn, formatNumber, textLang } from "@/lib/utils";

const SKILL_LABELS: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

/**
 * Course card.
 *
 * The card is an <article>; the title holds the one link, stretched over the
 * whole card with a pseudo-element. That keeps the entire card tappable while
 * letting the Save button be a real, separate control (a button inside a link
 * is invalid and unreliable in in-app browsers).
 */
const CourseCard = React.memo(function CourseCard({
  course,
  priority = false,
  className,
}: {
  course: CourseCardData;
  priority?: boolean;
  className?: string;
}) {
  const specs = [
    course.durationHours != null && course.durationHours > 0
      ? { icon: Timer, label: `${Math.round(course.durationHours * 10) / 10}h` }
      : null,
    course.lecturesCount != null && course.lecturesCount > 0
      ? { icon: Film, label: `${course.lecturesCount} lectures` }
      : null,
    course.sizeLabel ? { icon: HardDrive, label: course.sizeLabel } : null,
    { icon: Download, label: formatNumber(course.downloads) },
  ].filter(Boolean) as { icon: typeof Timer; label: string }[];

  return (
    <article
      className={cn(
        "group surface relative flex h-full flex-col overflow-hidden rounded-card p-2",
        "transition-[transform,box-shadow,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "hover:-translate-y-1.5 hover:border-primary/35 hover:shadow-glow",
        "has-[a:active]:scale-[0.99]",
        course.featured ? "edge-gradient shadow-elevated" : "",
        className
      )}
    >
      <div className="relative aspect-video overflow-hidden rounded-nested bg-muted">
        <CourseImage
          src={course.thumbnail}
          title={course.title}
          // Always lazy. On a phone no card is on the first screen of any
          // page, and an eagerly loaded thumbnail there is fetched before the
          // text that matters and delays it. The browser still loads a card
          // that is on screen (or close to it) straight away.
          loading={priority ? "eager" : "lazy"}
          className="transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
        />
        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
          {course.premium ? (
            <Badge variant="premium" className="shadow-soft">
              <Crown aria-hidden />
              Premium
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-white/92 font-semibold text-[#0e1022] ring-0 dark:bg-black/70 dark:text-white">
              Free
            </Badge>
          )}
          {course.featured && (
            <Badge variant="accent" className="shadow-soft">
              <Sparkles aria-hidden />
              Featured
            </Badge>
          )}
          {course.trending && !course.featured && (
            <Badge variant="warning" className="shadow-soft">
              <TrendingUp aria-hidden />
              Trending
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-2.5 pt-3.5 pb-2">
        <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {course.category?.name && <span className="truncate text-primary">{course.category.name}</span>}
          {course.category?.name && course.skillLevel && <span aria-hidden>·</span>}
          {course.skillLevel && <span className="shrink-0">{SKILL_LABELS[course.skillLevel]}</span>}
        </div>
        <h3
          lang={textLang(course.title)}
          className="font-display line-clamp-2 text-[1.0625rem] leading-snug font-bold tracking-[-0.015em] text-card-foreground transition-colors duration-300 group-hover:text-primary"
        >
          <Link
            href={`/courses/${course.slug}`}
            prefetch={false}
            className="after:absolute after:inset-0 after:rounded-card after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-background"
          >
            {course.title}
          </Link>
        </h3>
        {course.shortDescription && (
          <p lang={textLang(course.shortDescription)} className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
            {course.shortDescription}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3.5 text-xs text-muted-foreground">
          {specs.map(({ icon: Icon, label }) => (
            <span key={label} className="numeric inline-flex items-center gap-1">
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Above the stretched link, so it takes its own taps. */}
      <SaveButton
        className="absolute top-4 right-4 z-10"
        course={{
          slug: course.slug,
          title: course.title,
          thumbnail: course.thumbnail,
          category: course.category?.name ?? null,
          premium: course.premium,
        }}
      />
    </article>
  );
});

export { CourseCard };
