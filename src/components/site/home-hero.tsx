import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, Download, FolderOpen, Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { buttonClasses } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/site/animated-counter";
import { formatNumber } from "@/lib/utils";

interface HomeHeroProps {
  siteName: string;
  description: string;
  stats: { courses: number; downloads: number; categories: number };
  /** A few real categories, shown as floating shortcut chips on wide screens. */
  categories?: { name: string; slug: string }[];
}

type CSSVars = React.CSSProperties & Record<`--${string}`, string>;

const STAT_TONES = [
  "bg-primary/12 text-primary",
  "bg-violet/12 text-violet",
  "bg-pink/12 text-pink",
] as const;

/** Positions for the floating category chips around the stats card (lg+). */
const CHIP_SPOTS = [
  { className: "-top-6 left-2", rot: "-4deg", delay: "0s" },
  { className: "top-[38%] -right-12", rot: "3deg", delay: "-3s" },
  { className: "-bottom-5 left-10", rot: "2deg", delay: "-6s" },
] as const;

/**
 * Homepage hero. A server component: the entrance is CSS (`rise-in`, which
 * also plays with JavaScript disabled), the background drifts on transform
 * keyframes and moves with a scroll-timeline parallax, and the only client
 * code is the stat count-up. The search box is a plain GET form, so it works
 * before hydration.
 */
export function HomeHero({ siteName, description, stats, categories = [] }: HomeHeroProps) {
  const statItems = [
    { icon: BookOpen, value: stats.courses, label: "Courses" },
    { icon: Download, value: stats.downloads, label: "Downloads" },
    { icon: FolderOpen, value: stats.categories, label: "Categories" },
  ];
  const words = siteName.split(/\s+/).filter(Boolean);
  const chips = categories.slice(0, CHIP_SPOTS.length);

  return (
    <section className="relative isolate -mt-[4.5rem] overflow-hidden pt-[4.5rem]">
      {/* ---------- Animated gradient mesh ----------
          The drift and float loops run from `lg` up only. On phones they kept
          three viewport-sized layers animating for the life of the page,
          which cost measurable main-thread time in Lighthouse's mobile run;
          the static mesh still gives the same look there. */}
      <div aria-hidden className="parallax-slow pointer-events-none absolute inset-0 -z-10">
        <div className="absolute lg:animate-drift -top-40 -left-32 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(closest-side,var(--wash-1),transparent)]" />
        <div
          className="absolute lg:animate-drift -top-24 right-[-10rem] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(closest-side,var(--wash-3),transparent)]"
          style={{ animationDelay: "-8s" }}
        />
        <div
          className="absolute lg:animate-drift top-1/2 left-1/3 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(closest-side,var(--wash-2),transparent)]"
          style={{ animationDelay: "-15s" }}
        />
      </div>
      <div aria-hidden className="bg-dots pointer-events-none absolute inset-0 -z-10 opacity-60" />

      <div className="page-gutter mx-auto grid max-w-7xl items-center gap-12 pt-10 pb-16 sm:pt-16 sm:pb-20 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:pt-20 lg:pb-28">
        {/* ---------- Copy + search ---------- */}
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <p className="rise-in inline-flex items-center gap-2 rounded-full border border-border bg-card/90 py-1.5 pr-4 pl-1.5 text-sm font-medium text-muted-foreground shadow-soft">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
              <Sparkles className="h-3 w-3" aria-hidden />
              Free
            </span>
            <span>
              <span className="numeric font-semibold text-foreground">{formatNumber(stats.courses)}+</span>{" "}
              premium courses, always free
            </span>
          </p>

          <h1 className="text-display mt-6 text-balance">
            {words.map((word, i) => (
              <span
                key={`${word}-${i}`}
                className={`rise-in inline-block ${i === words.length - 1 && words.length > 1 ? "text-gradient pb-[0.08em]" : ""}`}
                style={{ "--d": `${90 + i * 80}ms` } as CSSVars}
              >
                {word}
                {i < words.length - 1 ? " " : ""}
              </span>
            ))}
          </h1>
          <p
            className="rise-in text-lead mt-5 max-w-xl text-pretty text-muted-foreground"
            style={{ "--d": "220ms" } as CSSVars}
          >
            {description}
          </p>

          <form
            action="/courses"
            method="get"
            role="search"
            className="rise-in mt-8 w-full max-w-xl"
            style={{ "--d": "300ms" } as CSSVars}
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
                className="h-14 rounded-full border-border bg-card pr-[7.5rem] pl-13 text-base shadow-none sm:text-base"
              />
              <button
                type="submit"
                className={buttonClasses("brand", "md", "absolute top-1/2 right-2 h-10 -translate-y-1/2 hover:-translate-y-1/2 active:-translate-y-1/2")}
              >
                Search
              </button>
            </div>
          </form>

          <div
            className="rise-in mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm lg:justify-start"
            style={{ "--d": "360ms" } as CSSVars}
          >
            <Link
              href="/courses"
              prefetch={false}
              className="group inline-flex items-center gap-1.5 rounded-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span className="link-underline">Browse all courses</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
            </Link>
            <Link
              href="/how-to-download"
              prefetch={false}
              className="link-underline rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              How downloading works
            </Link>
          </div>
        </div>

        {/* ---------- Visual: stats card + floating chips ---------- */}
        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          {/* Glow behind the card: a radial gradient, not a filter blur, so it
              costs no GPU blur layer. */}
          <div
            aria-hidden
            className="absolute -inset-10 -z-10 bg-[radial-gradient(closest-side,var(--wash-2),transparent),radial-gradient(closest-side_at_70%_70%,var(--wash-1),transparent)]"
          />
          <div
            className="rise-in surface relative rounded-panel p-5 shadow-floating sm:p-7 lg:rotate-[-1.5deg]"
            style={{ "--d": "260ms" } as CSSVars}
          >
            <div className="mb-5 flex items-center justify-between">
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
                  className="flex flex-col items-center gap-2 rounded-card bg-muted/70 px-2 py-4 text-center lg:flex-row lg:gap-4 lg:px-4 lg:text-left"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-nested lg:h-12 lg:w-12 ${STAT_TONES[i]}`}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="flex min-w-0 flex-col-reverse">
                    <span className="text-[0.7rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase sm:text-xs">
                      {label}
                    </span>
                    <span className="numeric font-display text-xl font-extrabold tracking-tight sm:text-3xl">
                      <AnimatedCounter value={value} />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Citrus sticker */}
          <div
            aria-hidden
            className="absolute -right-4 -bottom-8 hidden sm:block lg:animate-float"
            style={{ rotate: "8deg" }}
          >
            <div className="rise-in flex h-20 w-20 flex-col items-center justify-center rounded-full bg-accent text-center text-accent-foreground shadow-elevated ring-4 ring-background" style={{ "--d": "520ms" } as CSSVars}>
              <span className="font-display text-xl leading-none font-extrabold">100%</span>
              <span className="text-[0.65rem] font-bold tracking-wider uppercase">free</span>
            </div>
          </div>

          {/* Floating category chips — real links, wide screens only. */}
          {chips.map((chip, i) => {
            const spot = CHIP_SPOTS[i];
            return (
              <div
                key={chip.slug}
                className={`animate-float-slow absolute hidden lg:block ${spot.className}`}
                style={{ rotate: spot.rot, animationDelay: spot.delay }}
              >
                <Link
                  href={`/courses?category=${chip.slug}`}
                  prefetch={false}
                  className="rise-in group inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold shadow-elevated transition-[box-shadow,color] duration-300 hover:text-primary hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ "--d": `${560 + i * 90}ms` } as CSSVars}
                >
                  {chip.name}
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
