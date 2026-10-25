import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Crown, Download, Film, HardDrive, Sparkles, Timer, TrendingUp } from "lucide-react";
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

const CourseCard = React.memo(function CourseCard({ course, priority = false }: { course: CourseCardData; priority?: boolean }) {
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
 "group surface relative flex h-full flex-col overflow-hidden rounded-card p-2",
 "transition-[transform,box-shadow,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
 "hover:-translate-y-1.5 hover:border-primary/35 hover:shadow-glow",
 "active:scale-[0.99] active:shadow-soft",
 "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
 course.featured ? "edge-gradient shadow-elevated" : ""
 )}
 >
 <div className="relative aspect-video overflow-hidden rounded-nested bg-muted">
 <CourseImage
 src={course.thumbnail}
 title={course.title}
 loading={priority ? "eager" : "lazy"}
 className="transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]"
 />
 <div
 aria-hidden
 className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
 />
 <span
 aria-hidden
 className="absolute right-3 bottom-3 flex h-9 w-9 translate-y-2 items-center justify-center rounded-full bg-white text-[#0e1022] opacity-0 shadow-elevated transition-[opacity,translate] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
 >
 <ArrowUpRight className="h-4 w-4" />
 </span>
 <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
 {course.premium && (
 <Badge variant="premium" className="shadow-soft">
 <Crown aria-hidden />
 Premium
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
 <div className="absolute top-3 right-3">
 <Badge variant="secondary" className="bg-white/90 font-semibold text-[#0e1022] ring-0 dark:bg-black/70 dark:text-foreground">
 {course.skillLevel ? SKILL_LABELS[course.skillLevel] : "-"}
 </Badge>
 </div>
 </div>
 <div className="flex flex-1 flex-col px-2.5 pt-4 pb-2">
 <div className="flex items-start gap-3">
 <div className="flex-1 min-w-0">
 <h3 className="font-display line-clamp-2 text-[1.0625rem] leading-snug font-bold tracking-[-0.015em] text-card-foreground transition-colors duration-300 group-hover:text-primary">
 {course.title}
 </h3>
 {course.shortDescription && (
 <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
 {course.shortDescription}
 </p>
 )}
 </div>
 </div>
 {specs.length > 0 && (
 <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-xs text-muted-foreground">
 {specs.map(({ icon: Icon, label }) => (
 <span key={label} className="inline-flex items-center gap-1">
 <Icon className="h-3.5 w-3.5" aria-hidden />
 {label}
 </span>
 ))}
 <span className="inline-flex items-center gap-1">
 <Download className="h-3.5 w-3.5" aria-hidden />
 {formatNumber(course.downloads)} downloads
 </span>
 </div>
 )}
 <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
 {course.category?.name ? (
 <Badge variant="default" className="truncate">
 {course.category.name}
 </Badge>
 ) : (
 <span />
 )}
 <span className="text-xs text-muted-foreground" suppressHydrationWarning>
 {formatDistanceToNow(course.contentUpdatedAt, { addSuffix: true })}
 </span>
 </div>
 </div>
 </Link>
 );
});

export { CourseCard };
