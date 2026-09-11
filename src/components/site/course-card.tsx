import Link from "next/link";
import { ArrowUpRight, BarChart3, Clock3, Download, Film, HardDrive, Sparkles, Timer, TrendingUp } from "lucide-react";
import type { CourseCard as CourseCardData } from "@/lib/courses";
import { Badge } from "@/components/ui/badge";
import { CourseImage } from "@/components/site/course-image";
import { cn, formatNumber } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const SKILL_LABELS: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

export function CourseCard({ course, priority = false }: { course: CourseCardData; priority?: boolean }) {
  const specs = [
    course.durationHours != null && course.durationHours > 0
      ? { icon: Timer, label: `${Math.round(course.durationHours * 10) / 10}h` }
      : null,
    course.lecturesCount != null && course.lecturesCount > 0
      ? { icon: Film, label: `${course.lecturesCount} lectures` }
      : null,
    course.sizeLabel ? { icon: HardDrive, label: course.sizeLabel } : null,
  ].filter(Boolean) as { icon: typeof Timer; label: string }[];

  return (
    <Link
      href={`/courses/${course.slug}`}
      className={cn(
        // `surface`, not `glass-panel`. This card repeats 12-24 times in a grid,
        // and glass-panel carries `backdrop-filter: blur(24px) saturate(170%)` —
        // one blurred backdrop layer per card, each of which the compositor has
        // to re-resolve on every scroll frame. That is the single biggest cause
        // of sub-60fps scrolling on phones, and globals.css says so itself:
        // glass is for surfaces that genuinely float over content (dialogs,
        // menus, the sticky header), and on ordinary cards it "destroys text
        // contrast and turns the whole page into mush". `surface` is the token
        // built for exactly this — hairline border, inner top highlight, ambient
        // shadow — so the card keeps its physicality and gains contrast.
        "group surface relative flex h-full flex-col overflow-hidden rounded-card",
        // Scoped transition rather than `transition-all`: all would animate every
        // animatable property, including the shadow and (previously) the blur.
        "transition-[transform,box-shadow,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "hover:-translate-y-1 hover:shadow-elevated",
        // Touch feedback: the hover states above never fire on a phone, and
        // globals.css clears the tap highlight app-wide, so without this a tap
        // produced no acknowledgement at all.
        "active:scale-[0.99] active:shadow-soft",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        // A featured card earns a gradient hairline and a deeper resting
        // shadow, so the tier is legible at a glance rather than only from
        // reading its badge.
        course.featured ? "edge-gradient shadow-elevated ring-1 ring-inset ring-primary/20" : ""
      )}
    >
      <div className="relative aspect-video overflow-hidden bg-muted">
        <CourseImage
          src={course.thumbnail}
          title={course.title}
          priority={priority}
          className="transition-transform duration-500 ease-out group-hover:scale-[1.05]"
        />
        {/* Scrim only on hover, and only at the foot of the image, so the
            thumbnail is never permanently dimmed. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {/* No `backdrop-blur-sm` on these: the accent/warning variants fill with
              the opaque `--accent-soft`/`--warning-soft` tokens, so there was
              never anything visible behind them to blur — it bought a compositing
              layer per badge, on every card in the grid, for no visual change.
              `border-0` went too; Badge draws an inset ring, not a border. */}
          {course.featured && (
            <Badge variant="accent" className="shadow-soft">
              <Sparkles aria-hidden />
              Featured
            </Badge>
          )}
          {course.trending && (
            <Badge variant="warning" className="shadow-soft">
              <TrendingUp aria-hidden />
              Trending
            </Badge>
          )}
        </div>
        <span
          aria-hidden
          className="absolute right-3 bottom-3 flex h-9 w-9 translate-y-2 items-center justify-center rounded-full bg-card text-foreground opacity-0 shadow-elevated transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0 group-hover:opacity-100"
        >
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {(course.category || course.skillLevel) && (
          <span className="flex items-center justify-between gap-2">
            {course.category && (
              <span className="min-w-0 truncate text-eyebrow text-primary uppercase">
                {course.category.name}
              </span>
            )}
            {course.skillLevel && (
              <span className="ml-auto flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <BarChart3 className="h-3.5 w-3.5" aria-hidden />
                {SKILL_LABELS[course.skillLevel]}
              </span>
            )}
          </span>
        )}
        <h3 className="line-clamp-2 text-[0.9375rem] leading-snug font-semibold tracking-[-0.011em] text-card-foreground transition-colors duration-200 group-hover:text-primary">
          {course.title}
        </h3>
        {course.shortDescription && (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {course.shortDescription}
          </p>
        )}

        {/* Two tiers instead of one flat run of five metrics: what you get
            (specs) reads first, provenance (downloads/updated) is subordinate. */}
        <div className="mt-auto space-y-2 pt-3">
          {specs.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-foreground/75">
              {specs.map(({ icon: Icon, label }, i) => (
                <span key={label} className="inline-flex items-center gap-1">
                  {i > 0 && <span aria-hidden className="mr-2 h-3 w-px bg-border" />}
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  <span className="numeric">{label}</span>
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/70 pt-2.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Download className="h-3.5 w-3.5" aria-hidden />
              <span className="numeric">{formatNumber(course.downloads)}</span>
            </span>
            <span className="inline-flex items-center gap-1" suppressHydrationWarning>
              <Clock3 className="h-3.5 w-3.5" aria-hidden />
              {formatDistanceToNow(course.contentUpdatedAt, { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
