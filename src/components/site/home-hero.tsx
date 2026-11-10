import Link from "next/link";
import { ArrowRight, BookOpen, Download, FolderOpen, Gift, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { buttonClasses } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/site/animated-counter";
import { FreeUnlocksChip } from "@/components/site/free-unlocks-chip";
import { formatNumber } from "@/lib/utils";

interface HomeHeroProps {
  siteName: string;
  description: string;
  stats: { courses: number; downloads: number; categories: number };
  /** Free unlocks per day (admin setting), for the headline chip. */
  freeLimit: number;
  /** The busiest categories, shown as quick filters under the search box. */
  categories?: { name: string; slug: string }[];
}

type CSSVars = React.CSSProperties & Record<`--${string}`, string>;

const STAT_TONES = ["bg-primary/12 text-primary", "bg-sky/12 text-sky", "bg-accent/25 text-accent-ink"] as const;

/**
 * Homepage hero. A server component: the entrance is CSS (`rise-in`, which
 * also plays with JavaScript disabled), the background is one static gradient
 * mesh that only drifts on large screens, and the only client code is the
 * stat count-up and the unlock counter. The search box is a plain GET form,
 * so it works before hydration and in every in-app browser.
 */
export function HomeHero({ siteName, description, stats, freeLimit, categories = [] }: HomeHeroProps) {
  const statItems = [
    { icon: BookOpen, value: stats.courses, label: "Courses" },
    { icon: Download, value: stats.downloads, label: "Downloads" },
    { icon: FolderOpen, value: stats.categories, label: "Categories" },
  ];
  const words = siteName.split(/\s+/).filter(Boolean);

  return (
    <section className="relative isolate -mt-[4.5rem] overflow-hidden pt-[4.5rem]">
      {/* One layer, painted once. `hero-mesh` is hidden on low-end devices. */}
      <div
        aria-hidden
        className="hero-mesh parallax-slow pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(34rem_26rem_at_8%_0%,var(--wash-1),transparent_70%),radial-gradient(30rem_24rem_at_96%_8%,var(--wash-5),transparent_70%),radial-gradient(28rem_22rem_at_55%_70%,var(--wash-2),transparent_70%)] lg:animate-drift"
      />
      <div aria-hidden className="bg-dots pointer-events-none absolute inset-0 -z-10 opacity-50" />

      <div className="page-gutter mx-auto grid max-w-7xl items-center gap-10 pt-8 pb-10 sm:pt-14 sm:pb-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:pt-20 lg:pb-24">
        {/* ---------- Copy + search ---------- */}
        <div className="flex min-w-0 flex-col items-center text-center lg:items-start lg:text-left">
          <p className="rise-in inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-card/90 py-1.5 pr-4 pl-1.5 text-sm font-medium text-muted-foreground shadow-soft">
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
              <Gift className="h-3 w-3" aria-hidden />
              Free
            </span>
            <span className="truncate">
              <span className="numeric font-semibold text-foreground">{freeLimit}</span> course unlocks every day
            </span>
          </p>

          <h1 className="text-display mt-5 text-balance">
            {words.map((word, i) => (
              <span
                key={`${word}-${i}`}
                className={`inline-block ${i === words.length - 1 && words.length > 1 ? "text-gradient pb-[0.08em]" : ""}`}
              >
                {word}
                {i < words.length - 1 ? " " : ""}
              </span>
            ))}
          </h1>
          <p className="text-lead mt-4 max-w-xl text-pretty text-muted-foreground">{description}</p>

          <form
            action="/courses"
            method="get"
            role="search"
            className="rise-in mt-7 w-full max-w-xl"
            style={{ "--d": "80ms" } as CSSVars}
          >
            <label htmlFor="hero-search" className="sr-only">
              Search courses
            </label>
            <div className="group/search relative rounded-full shadow-elevated transition-shadow duration-500 focus-within:shadow-glow">
              <Search
                className="pointer-events-none absolute top-1/2 left-5 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors duration-300 group-focus-within/search:text-primary"
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
                className="h-14 rounded-full border-border bg-card pr-[7.25rem] pl-13 text-base shadow-none sm:text-base"
              />
              <button
                type="submit"
                className={buttonClasses("brand", "md", "absolute top-1/2 right-2 h-10 -translate-y-1/2 hover:-translate-y-1/2 active:-translate-y-1/2")}
              >
                Search
              </button>
            </div>
          </form>

          {/* Quick category filters: one swipeable row on phones. */}
          {categories.length > 0 && (
            <nav
              aria-label="Popular categories"
              className="rise-in mt-4 flex w-full max-w-xl items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] lg:flex-wrap lg:overflow-visible [&::-webkit-scrollbar]:hidden"
              style={{ "--d": "140ms" } as CSSVars}
            >
              {categories.map((c) => (
                <Link
                  key={c.slug}
                  href={`/courses?category=${c.slug}`}
                  prefetch={false}
                  className="inline-flex h-10 shrink-0 items-center rounded-full border border-border bg-card/80 px-4 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {c.name}
                </Link>
              ))}
              <Link
                href="/courses"
                prefetch={false}
                className="group inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                All courses
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
              </Link>
            </nav>
          )}

          <div className="rise-in mt-5 flex w-full max-w-xl justify-center lg:justify-start" style={{ "--d": "200ms" } as CSSVars}>
            <FreeUnlocksChip />
          </div>
        </div>

        {/* ---------- Stats ---------- */}
        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div
            aria-hidden
            className="absolute -inset-10 -z-10 hidden bg-[radial-gradient(closest-side,var(--wash-2),transparent)] lg:block"
          />
          <div
            className="rise-in surface relative rounded-panel p-4 shadow-elevated sm:p-6 lg:rotate-[-1.5deg] lg:shadow-floating"
            style={{ "--d": "160ms" } as CSSVars}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-eyebrow text-muted-foreground uppercase">Library at a glance</p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                </span>
                Live
              </span>
            </div>
            <ul className="grid grid-cols-3 gap-2 lg:grid-cols-1 lg:gap-3">
              {statItems.map(({ icon: Icon, value, label }, i) => (
                <li
                  key={label}
                  className="flex flex-col items-center gap-2 rounded-card bg-muted/70 px-2 py-3.5 text-center lg:flex-row lg:gap-4 lg:px-4 lg:py-4 lg:text-left"
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-nested lg:h-12 lg:w-12 ${STAT_TONES[i]}`}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="flex min-w-0 flex-col-reverse">
                    <span className="text-[0.7rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase sm:text-xs">
                      {label}
                    </span>
                    <span className="numeric font-display text-xl font-extrabold tracking-tight sm:text-3xl">
                      <AnimatedCounter value={value} />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 hidden items-center justify-between gap-3 border-t border-border pt-4 text-sm text-muted-foreground lg:flex">
              <span>
                <span className="numeric font-semibold text-foreground">{formatNumber(stats.courses)}</span> courses, new
                ones added regularly
              </span>
              <Link href="/courses?sort=newest" prefetch={false} className="shrink-0 font-semibold text-primary hover:underline">
                See what&apos;s new
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
