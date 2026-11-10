import * as React from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Download, Link2, MousePointerClick, Zap } from "lucide-react";
import type { Metadata } from "next";
import { getHomepageData } from "@/lib/courses";
import { getSiteSettings } from "@/lib/settings";
import { getFreeConfig } from "@/lib/free-unlocks";
import { absoluteUrl, cn, formatNumber, safeJsonLd } from "@/lib/utils";
import { CourseCard } from "@/components/site/course-card";
import { Section, SectionHeading } from "@/components/site/section";
import { Reveal, Stagger, StaggerItem } from "@/components/site/reveal";
import { Spotlight } from "@/components/motion/interactive";
import { HomeHero } from "@/components/site/home-hero";
import { categoryIcon } from "@/components/site/category-icon";
import { FreeVsPremium } from "@/components/site/free-vs-premium";
import { RecentRail } from "@/components/site/library-views";
import { buttonClasses } from "@/components/ui/button";

export const revalidate = 120;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const CATEGORY_GRID_LIMIT = 12;

/** Icon-tile tones cycled across the category grid, so the brand hues share the load. */
const CATEGORY_TONES = [
  "bg-primary/12 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
  "bg-sky/12 text-sky group-hover:bg-sky group-hover:text-white",
  "bg-pink/12 text-pink group-hover:bg-pink group-hover:text-white",
  "bg-accent/30 text-accent-ink group-hover:bg-accent group-hover:text-accent-foreground",
] as const;

/**
 * Column classes keyed by how many cards a rail actually has, from `sm` up.
 * A rail with one featured course on a three-column grid sat alone against
 * two empty thirds and read as a rendering fault. Written out in full because
 * Tailwind cannot see computed class names.
 */
const RAIL_COLUMNS: Record<number, string> = {
  1: "sm:grid-cols-1 sm:max-w-sm",
  2: "sm:grid-cols-2 sm:max-w-3xl",
  3: "sm:grid-cols-2 lg:grid-cols-3",
};

/**
 * Each below-the-fold block is its own Suspense boundary. Nothing in them
 * suspends; the boundary is there so React hydrates the page in several short
 * tasks instead of one long one, which keeps a phone responsive while the
 * page becomes interactive.
 */
function Island({ children }: { children: React.ReactNode }) {
  return <React.Suspense fallback={null}>{children}</React.Suspense>;
}

/** One shared shell for the course rails, so they cannot drift apart. */
function CourseRail({
  eyebrow,
  title,
  subtitle,
  href,
  courses,
  columns = "three",
  priority = false,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  href: string;
  courses: Awaited<ReturnType<typeof getHomepageData>>["featured"];
  columns?: "three" | "four";
  priority?: boolean;
}) {
  if (courses.length === 0) return null;
  return (
    <Island>
      <Section>
        <Reveal>
          <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} href={href} />
        </Reveal>
        {/* Phones: one swipeable row with the next card peeking in, so four
            rails do not become forty screens of stacked cards. From `sm` up:
            the grid. The negative margin lets cards scroll edge to edge while
            the first one still lines up with the page gutter. */}
        <Stagger
          className={cn(
            "-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "sm:mx-0 sm:grid sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0",
            RAIL_COLUMNS[courses.length] ??
              (columns === "four" ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3")
          )}
        >
          {courses.map((course, i) => (
            <StaggerItem
              key={course.id}
              className={cn(
                "shrink-0 snap-start sm:w-auto sm:max-w-none",
                courses.length === 1 ? "w-full" : "w-[82%] max-w-[21rem]"
              )}
            >
              <CourseCard course={course} priority={priority && i < 2} />
            </StaggerItem>
          ))}
        </Stagger>
        <div className="mt-5 sm:hidden">
          <Link href={href} className={buttonClasses("outline", "md", "w-full")}>
            View all
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </Section>
    </Island>
  );
}

export default async function HomePage() {
  const [{ featured, trending, mostDownloaded, recent, categories, stats }, settings, freeConfig] =
    await Promise.all([getHomepageData(), getSiteSettings(), getFreeConfig()]);
  const freeLimit = freeConfig.limit;

  // Sitelinks-searchbox + organization markup; every value is real site data.
  const websiteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: settings.siteName,
    url: absoluteUrl(),
    potentialAction: {
      "@type": "SearchAction",
      target: `${absoluteUrl("/courses")}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
  const organizationLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.siteName,
    url: absoluteUrl(),
    ...(settings.logoUrl ? { logo: absoluteUrl(settings.logoUrl) } : {}),
  };

  // Busiest categories first for the hero's quick filters.
  const topCategories = [...categories]
    .sort((a, b) => b._count.courses - a._count.courses)
    .slice(0, 5)
    .map(({ name, slug }) => ({ name, slug }));

  const steps = [
    {
      icon: MousePointerClick,
      title: "Pick a course",
      text: "Search or browse by category. Every course page shows what is inside before you download.",
    },
    {
      icon: Link2,
      title: "Finish one short link",
      text: `Free unlocks go through a quick verification link. You get ${freeLimit} a day, with no account.`,
    },
    {
      icon: Download,
      title: "Download",
      text: "You come straight back to your course. Opening a course you already unlocked is always free.",
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd([websiteLd, organizationLd]) }}
      />

      <HomeHero
        siteName={settings.siteName}
        description={settings.description}
        stats={stats}
        freeLimit={freeLimit}
        categories={topCategories}
      />

      {/* ---------- Categories ---------- */}
      {categories.length > 0 && (
        <Island>
          <Section rhythm="tight">
            <Reveal>
              <SectionHeading
                eyebrow="Explore"
                title="Browse by category"
                subtitle="Find courses in the field you want to master"
                href={categories.length > CATEGORY_GRID_LIMIT ? "/courses" : undefined}
                linkLabel="View all categories"
              />
            </Reveal>
            <Stagger stagger={0.04} className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {categories.slice(0, CATEGORY_GRID_LIMIT).map((category, i) => {
                const Icon = categoryIcon(category.name, category.icon);
                return (
                  <StaggerItem key={category.id}>
                    <Spotlight className="h-full overflow-hidden rounded-card" radius={220}>
                      <Link
                        href={`/courses?category=${category.slug}`}
                        prefetch={false}
                        className="group surface flex h-full flex-col items-start gap-3 rounded-card p-4 transition-[transform,box-shadow,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-primary/30 hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] sm:flex-row sm:items-center sm:gap-4"
                      >
                        <span
                          className={cn(
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-nested transition-[transform,background-color,color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-rotate-6 group-hover:scale-110",
                            CATEGORY_TONES[i % CATEGORY_TONES.length]
                          )}
                        >
                          <Icon className="h-5 w-5" aria-hidden />
                        </span>
                        <span className="flex w-full min-w-0 flex-1 flex-col">
                          <span className="font-display line-clamp-2 leading-snug font-bold tracking-[-0.01em] break-words sm:block sm:text-ellipsis sm:whitespace-nowrap">
                            {category.name}
                          </span>
                          <span className="numeric text-sm text-muted-foreground">
                            {category._count.courses} {category._count.courses === 1 ? "course" : "courses"}
                          </span>
                        </span>
                        <ArrowUpRight
                          className="hidden h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-[opacity,translate,color] duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary group-hover:opacity-100 sm:block"
                          aria-hidden
                        />
                      </Link>
                    </Spotlight>
                  </StaggerItem>
                );
              })}
            </Stagger>
          </Section>
        </Island>
      )}

      <CourseRail
        eyebrow="Hand-picked"
        title="Featured courses"
        subtitle="Chosen by our team for depth and production quality"
        href="/courses?flag=featured"
        courses={featured}
        priority
      />

      {/* Appears only once this browser has opened a course. */}
      <Island>
        <RecentRail />
      </Island>

      <CourseRail
        eyebrow="This week"
        title="Trending now"
        subtitle="What everyone is downloading right now"
        href="/courses?flag=trending"
        courses={trending}
      />

      {/* ---------- How it works ---------- */}
      <Island>
        <Section rhythm="tight">
          <Reveal>
            <SectionHeading
              eyebrow="How it works"
              title="From search to download in three steps"
              subtitle="No sign-up wall. The short link is what keeps the free library running."
              href="/how-to-download"
              linkLabel="Full guide"
            />
          </Reveal>
          <Stagger as="ul" stagger={0.08} className="grid gap-4 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <StaggerItem as="li" key={title}>
                <div className="surface relative flex h-full gap-4 rounded-card p-5 md:flex-col md:p-6">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-nested bg-primary-soft text-primary ring-1 ring-inset ring-primary/15">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="numeric text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
                      Step {i + 1}
                    </p>
                    <h3 className="text-subheading mt-1">{title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
          <Reveal className="mt-4">
            <p className="flex items-start gap-2.5 rounded-card border border-gold/30 bg-gold-soft/60 px-4 py-3 text-sm">
              <Zap className="mt-0.5 h-4 w-4 shrink-0 text-gold-ink" aria-hidden />
              <span>
                <span className="font-semibold text-gold-ink">In a hurry?</span>{" "}
                <span className="text-muted-foreground">
                  Premium skips the link and the wait on every download.{" "}
                </span>
                <Link href="/premium" className="font-semibold text-gold-ink underline underline-offset-2">
                  See Premium
                </Link>
              </span>
            </p>
          </Reveal>
        </Section>
      </Island>

      <CourseRail
        eyebrow="All time"
        title="Most downloaded"
        subtitle="Community favourites, ranked by real downloads"
        href="/courses?sort=popular"
        courses={mostDownloaded}
      />
      <CourseRail
        eyebrow="Fresh"
        title="Recently added"
        subtitle="New courses land here first"
        href="/courses?sort=newest"
        courses={recent}
        columns="four"
      />

      {/* ---------- Free vs Premium ---------- */}
      <Island>
        <Section rhythm="default">
          <Reveal>
            <SectionHeading
              eyebrow="Compare"
              title="Free or Premium: your call"
              subtitle="Everything in the free library stays free. Premium is for speed and the extras."
              align="center"
            />
          </Reveal>
          <Reveal variant="scale">
            <FreeVsPremium freeLimit={freeLimit} />
          </Reveal>
        </Section>
      </Island>

      {/* ---------- Closing CTA ---------- */}
      <Island>
        <Section rhythm="tight" className="pb-6 sm:pb-8">
          <Reveal>
            <div className="surface relative overflow-hidden rounded-feature px-6 py-12 text-center sm:px-12 sm:py-16">
              <div aria-hidden className="bg-aurora pointer-events-none absolute inset-0" />
              <div aria-hidden className="bg-dots pointer-events-none absolute inset-0 opacity-70" />
              <div className="relative mx-auto max-w-2xl">
                <h2 className="text-heading text-balance">
                  Your next skill is <span className="text-gradient">one search away</span>
                </h2>
                <p className="mt-3 text-pretty text-muted-foreground sm:text-lg">
                  {formatNumber(stats.courses)} courses across {stats.categories} categories, with {freeLimit} free
                  unlocks every day.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <Link href="/courses" className={buttonClasses("brand", "lg", "group")}>
                    Explore courses
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                  </Link>
                  <Link href="/how-to-download" className={buttonClasses("outline", "lg")}>
                    How to download
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </Section>
      </Island>
    </>
  );
}
