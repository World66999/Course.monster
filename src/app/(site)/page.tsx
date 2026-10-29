import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Briefcase,
  Code2,
  Megaphone,
  Palette,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import { getHomepageData } from "@/lib/courses";
import { getSiteSettings } from "@/lib/settings";
import { absoluteUrl, cn, formatNumber, safeJsonLd } from "@/lib/utils";
import { CourseCard } from "@/components/site/course-card";
import { Section, SectionHeading } from "@/components/site/section";
import { Reveal, Stagger, StaggerItem } from "@/components/site/reveal";
import { Spotlight } from "@/components/motion/interactive";
import { HomeHero } from "@/components/site/home-hero";
import { buttonClasses } from "@/components/ui/button";

export const revalidate = 120;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const CATEGORY_GRID_LIMIT = 12;

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  code: Code2,
  palette: Palette,
  "bar-chart": BarChart3,
  megaphone: Megaphone,
  briefcase: Briefcase,
  smartphone: Smartphone,
};

/** Icon-tile tones cycled across the category grid, so the brand hues share the load. */
const CATEGORY_TONES = [
  "bg-primary/12 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
  "bg-violet/12 text-violet group-hover:bg-violet group-hover:text-white",
  "bg-pink/12 text-pink group-hover:bg-pink group-hover:text-white",
  "bg-accent/40 text-accent-ink group-hover:bg-accent group-hover:text-accent-foreground",
] as const;

/**
 * Column classes keyed by how many cards a rail actually has.
 *
 * A rail with one featured course was previously laid out on the same
 * three-column grid as a rail with eight, so the card sat alone against two
 * empty thirds and read as a rendering fault. Constraining the track count (and
 * the max width) to the real item count keeps a short rail looking deliberate.
 * Classes are written out in full because Tailwind cannot see computed names.
 */
const RAIL_COLUMNS: Record<number, string> = {
  1: "grid-cols-1 sm:max-w-sm",
  2: "grid-cols-1 sm:grid-cols-2 sm:max-w-3xl",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};

/** One shared shell for the four course rails, so they cannot drift apart. */
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
    <Section>
      <Reveal>
        <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} href={href} />
      </Reveal>
      <Stagger
        className={cn(
          "grid gap-5",
          RAIL_COLUMNS[courses.length] ??
            (columns === "four"
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")
        )}
      >
        {courses.map((course, i) => (
          <StaggerItem key={course.id}>
            <CourseCard course={course} priority={priority && i < 2} />
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
}

export default async function HomePage() {
  const [{ featured, trending, mostDownloaded, recent, categories, stats }, settings] =
    await Promise.all([getHomepageData(), getSiteSettings()]);

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
        categories={categories.slice(0, 3).map(({ name, slug }) => ({ name, slug }))}
      />

      {/* ---------- Categories ---------- */}
      {categories.length > 0 && (
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
              const Icon = CATEGORY_ICONS[category.icon ?? ""] ?? BookOpen;
              return (
                <StaggerItem key={category.id}>
                  <Spotlight className="h-full overflow-hidden rounded-card" radius={220}>
                    <Link
                      href={`/courses?category=${category.slug}`}
                      className="group surface flex h-full flex-col items-start gap-3 rounded-card p-4 sm:flex-row sm:items-center sm:gap-4 transition-[transform,box-shadow,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-primary/30 hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <span
                        className={cn(
                          "flex h-12 w-12 shrink-0 items-center justify-center rounded-nested transition-[transform,background-color,color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-rotate-6 group-hover:scale-110",
                          CATEGORY_TONES[i % CATEGORY_TONES.length]
                        )}
                      >
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="flex w-full min-w-0 flex-1 flex-col">
                        <span className="font-display line-clamp-2 leading-snug font-bold tracking-[-0.01em] break-words sm:line-clamp-1">
                          {category.name}
                        </span>
                        <span className="numeric text-sm text-muted-foreground">
                          {category._count.courses} courses
                        </span>
                      </span>
                      <ArrowUpRight
                        className="hidden h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition sm:block-[opacity,translate,color] duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary group-hover:opacity-100"
                        aria-hidden
                      />
                    </Link>
                  </Spotlight>
                </StaggerItem>
              );
            })}
          </Stagger>
        </Section>
      )}

      <CourseRail
        eyebrow="Hand-picked"
        title="Featured courses"
        subtitle="Chosen by our team for depth and production quality"
        href="/courses"
        courses={featured}
        priority
      />
      <CourseRail
        eyebrow="This week"
        title="Trending now"
        subtitle="What everyone is downloading right now"
        href="/courses?sort=popular"
        courses={trending}
      />
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

      {/* ---------- Value props: bento ---------- */}
      <Section rhythm="loose">
        <div className="grid gap-4 lg:grid-cols-5">
          {/* Feature panel: the one saturated block on the page. */}
          <Reveal variant="scale" className="lg:col-span-3">
            <div className="bg-brand noise relative flex h-full flex-col justify-between overflow-hidden rounded-feature p-8 text-white shadow-floating sm:p-12">
              <div
                aria-hidden
                className="animate-float-slow pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full border-[28px] border-white/10"
              />
              <div
                aria-hidden
                className="animate-float pointer-events-none absolute right-24 -bottom-10 h-28 w-28 rounded-full bg-accent/90"
                style={{ animationDelay: "-4s" }}
              />
              <div className="relative">
                <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-eyebrow uppercase ring-1 ring-inset ring-white/25">
                  Why here
                </p>
                <h2 className="text-title max-w-lg text-balance">
                  Built for people who actually finish courses
                </h2>
                <p className="mt-4 max-w-md text-lg text-pretty text-white/85">
                  No paywalls, no drip-feed, no account required to download.
                </p>
              </div>
              <div className="relative mt-10 flex flex-wrap gap-3">
                <Link
                  href="/courses"
                  className="group inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-semibold text-[#0e1022] shadow-elevated transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-floating focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
                >
                  Start browsing
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                </Link>
                <Link
                  href="/how-to-download"
                  className="inline-flex h-12 items-center rounded-full px-6 font-semibold text-white ring-1 ring-inset ring-white/40 transition-[background-color] duration-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  How it works
                </Link>
              </div>
            </div>
          </Reveal>

          <Stagger stagger={0.1} className="grid gap-4 sm:grid-cols-3 lg:col-span-2 lg:grid-cols-1">
            {[
              {
                icon: Zap,
                tone: "bg-accent text-accent-foreground",
                title: "Fast downloads",
                text: "Every course goes through a quick, protected download flow — no signup required.",
              },
              {
                icon: ShieldCheck,
                tone: "bg-primary text-primary-foreground",
                title: "Verified content",
                text: "Courses are checked and organised by category so you always know what you get.",
              },
              {
                icon: Sparkles,
                tone: "bg-pink text-white",
                title: "Always free",
                text: "Every course on this platform is free to download. Forever.",
              },
            ].map(({ icon: Icon, tone, title, text }) => (
              <StaggerItem key={title}>
                <div className="group surface flex h-full gap-4 rounded-card p-5 transition-[transform,box-shadow,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-primary/30 hover:shadow-glow sm:flex-col lg:flex-row">
                  <span
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-nested shadow-soft transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-rotate-6 group-hover:scale-110",
                      tone
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-subheading mb-1.5">{title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </Section>

      {/* ---------- Closing CTA ---------- */}
      <Section rhythm="tight" className="pb-4 sm:pb-6">
        <Reveal>
          <div className="surface relative overflow-hidden rounded-feature px-6 py-12 text-center sm:px-12 sm:py-16">
            <div aria-hidden className="bg-aurora pointer-events-none absolute inset-0" />
            <div aria-hidden className="bg-dots pointer-events-none absolute inset-0 opacity-70" />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-heading text-balance">
                Your next skill is <span className="text-gradient">one search away</span>
              </h2>
              <p className="mt-3 text-pretty text-muted-foreground sm:text-lg">
                {formatNumber(stats.courses)} courses across {stats.categories} categories, free to download.
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
    </>
  );
}
