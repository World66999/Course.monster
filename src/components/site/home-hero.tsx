import Link from "next/link";
import { ArrowRight, BookOpen, Download, FolderOpen, Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { buttonClasses } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";

interface HomeHeroProps {
  siteName: string;
  description: string;
  stats: { courses: number; downloads: number; categories: number };
}

/**
 * Homepage hero. A server component with no client JavaScript at all.
 *
 * It replaced a 900-line framer-motion "book" whose page-flip machinery cost
 * the homepage ~59 kB of JS, filled a phone's first screen with empty space,
 * drew its spine through the stat cards on narrow screens, and greeted
 * visitors with a hard-coded old brand name. This keeps the same visual
 * language — the eyebrow pill, grid + aurora backdrop, primary accents and
 * live stats — and puts the thing visitors came for, finding a course, in
 * the first screen as a plain GET form that works before hydration.
 */
export function HomeHero({ siteName, description, stats }: HomeHeroProps) {
  const statItems = [
    { icon: BookOpen, value: stats.courses, label: "Courses" },
    { icon: Download, value: stats.downloads, label: "Downloads" },
    { icon: FolderOpen, value: stats.categories, label: "Categories" },
  ];

  return (
    <section className="relative isolate overflow-hidden border-b border-border/60">
      <div className="bg-grid absolute inset-0 -z-10" aria-hidden />
      <div className="bg-aurora absolute inset-0 -z-10" aria-hidden />

      <div className="page-gutter mx-auto flex max-w-5xl flex-col items-center pt-12 pb-14 text-center sm:pt-20 sm:pb-20 lg:pt-24">
        <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-1.5 text-sm font-medium text-muted-foreground shadow-soft">
          <Sparkles className="h-4 w-4 text-accent" aria-hidden />
          <span className="numeric font-semibold text-foreground">{formatNumber(stats.courses)}+</span>
          premium courses, always free
        </p>

        <h1 className="text-display mt-6 text-balance">{siteName}</h1>
        <p className="text-lead mt-4 max-w-2xl text-pretty text-muted-foreground">{description}</p>

        <form
          action="/courses"
          method="get"
          role="search"
          className="mt-8 flex w-full max-w-xl flex-col gap-2 sm:flex-row"
        >
          <label htmlFor="hero-search" className="sr-only">
            Search courses
          </label>
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="hero-search"
              name="q"
              type="search"
              placeholder="Search courses, e.g. Python"
              autoComplete="off"
              enterKeyHint="search"
              maxLength={100}
              className="h-12 rounded-control pl-10 text-base shadow-soft"
            />
          </div>
          <button type="submit" className={buttonClasses("primary", "lg", "shrink-0")}>
            Search
          </button>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
          <Link
            href="/courses"
            prefetch={false}
            className="inline-flex items-center gap-1.5 rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Browse all courses
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/how-to-download"
            prefetch={false}
            className="rounded-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            How downloading works
          </Link>
        </div>

        <dl className="mt-10 grid w-full max-w-3xl grid-cols-3 gap-2 sm:mt-14 sm:gap-4">
          {statItems.map(({ icon: Icon, value, label }) => (
            <div
              key={label}
              className="surface flex flex-col items-center gap-1 rounded-card px-2 py-4 sm:flex-row sm:gap-4 sm:px-5 sm:text-left"
            >
              <span className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary sm:mb-0 sm:h-11 sm:w-11">
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
              </span>
              <div className="flex min-w-0 flex-col-reverse">
                <dt className="text-[0.68rem] font-medium tracking-[0.12em] text-muted-foreground uppercase sm:text-xs">
                  {label}
                </dt>
                <dd className="numeric text-xl font-bold tracking-tight sm:text-2xl">{formatNumber(value)}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
