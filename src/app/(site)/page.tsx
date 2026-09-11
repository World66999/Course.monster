import Link from "next/link";
import {
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
import { absoluteUrl, cn, safeJsonLd } from "@/lib/utils";
import { CourseCard } from "@/components/site/course-card";
import { Section, SectionHeading } from "@/components/site/section";
import { Reveal, Stagger, StaggerItem } from "@/components/site/reveal";
import { Spotlight } from "@/components/motion/interactive";
import { BookHero } from "@/components/site/book-hero";

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

      {/* ---------- Cinematic Book Hero ---------- */}
      <BookHero
        siteName={settings.siteName}
        description={settings.description}
        stats={stats}
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
          <Stagger stagger={0.035} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {categories.slice(0, CATEGORY_GRID_LIMIT).map((category) => {
              const Icon = CATEGORY_ICONS[category.icon ?? ""] ?? BookOpen;
              return (
                <StaggerItem key={category.id}>
                  <Spotlight className="h-full overflow-hidden rounded-card" radius={220}>
                  <Link
                    href={`/courses?category=${category.slug}`}
                    className="group surface flex h-full flex-col items-center gap-3 rounded-card p-5 text-center transition-[transform,box-shadow,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-control bg-primary/10 text-primary transition-[transform,background-color,color,box-shadow] duration-500 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-[0_0_20px_color-mix(in_srgb,var(--primary)_30%,transparent)]">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="text-sm leading-tight font-semibold text-balance">
                      {category.name}
                    </span>
                    <span className="numeric mt-auto text-xs text-muted-foreground">
                      {category._count.courses} courses
                    </span>
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

      {/* ---------- Value props ---------- */}
      <Section rhythm="loose">
        <div className="surface relative overflow-hidden rounded-feature p-8 sm:p-12 shadow-floating">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--primary)_15%,transparent),transparent_70%)]" aria-hidden />
          <div className="noise pointer-events-none absolute inset-0 -z-10 opacity-20" aria-hidden />
          <Reveal>
            <SectionHeading
              align="center"
              eyebrow="Why here"
              title="Built for people who actually finish courses"
              subtitle="No paywalls, no drip-feed, no account required to download."
            />
          </Reveal>
          <Stagger stagger={0.08} className="grid gap-8 sm:grid-cols-3">
            {[
              {
                icon: Zap,
                title: "Fast downloads",
                text: "Every course goes through a quick, protected download flow — no signup required.",
              },
              {
                icon: ShieldCheck,
                title: "Verified content",
                text: "Courses are checked and organised by category so you always know what you get.",
              },
              {
                icon: Sparkles,
                title: "Always free",
                text: "Every course on this platform is free to download. Forever.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <StaggerItem key={title}>
                {/* `surface`, not `glass-veil`: these three cards carry real body
                    copy, and globals.css marks glass-veil "decorative only —
                    never put body copy on this one" precisely because its blur
                    muddies text. They also sat inside a glass-panel, so this was
                    a blurred backdrop nested inside another blurred backdrop —
                    the most expensive compositing case there is. */}
                <div className="group surface relative flex h-full flex-col items-start gap-4 rounded-card p-6 transition-[transform,box-shadow,border-color] duration-500 hover:-translate-y-1 hover:shadow-elevated">
                  <span className="flex h-12 w-12 items-center justify-center rounded-nested bg-primary/10 text-primary ring-1 ring-inset ring-primary/20 transition-[transform,background-color,color,box-shadow] duration-500 group-hover:bg-primary group-hover:text-primary-foreground group-hover:ring-primary group-hover:shadow-[0_0_20px_color-mix(in_srgb,var(--primary)_30%,transparent)] group-hover:scale-110">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-subheading mb-2">{title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </Section>
    </>
  );
}
