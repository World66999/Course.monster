import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Briefcase,
  Code2,
  Download,
  FolderOpen,
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
import { absoluteUrl, safeJsonLd } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/button";
import { CourseCard } from "@/components/site/course-card";
import { Section, SectionHeading } from "@/components/site/section";
import { Reveal } from "@/components/site/reveal";
import { AnimatedCounter } from "@/components/site/animated-counter";

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
      {/* ---------- Hero ---------- */}
      <div className="relative overflow-hidden">
        <div className="bg-grid absolute inset-0" aria-hidden />
        <div
          aria-hidden
          className="animate-float absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-accent/30 to-primary/30 blur-3xl"
        />
        <div
          aria-hidden
          className="animate-float-delayed absolute top-10 -right-40 hidden h-72 w-96 rounded-full bg-gradient-to-l from-primary/15 to-accent/10 blur-3xl lg:block"
        />
        <Section className="relative flex flex-col items-center py-20 text-center sm:py-28">
          <Reveal>
            <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground shadow-soft inset-shadow-highlight">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />
              {stats.courses}+ premium courses, 100% free
            </span>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="mt-6 max-w-3xl text-4xl font-extrabold tracking-tight text-balance sm:text-6xl">
              Learn anything.
              <br />
              <span className="text-gradient">Download everything.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-6 max-w-xl text-lg text-pretty text-muted-foreground">
              {settings.description}
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link href="/courses" className={buttonClasses("primary", "lg")}>
                Browse courses
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/how-to-download" className={buttonClasses("outline", "lg")}>
                How it works
              </Link>
            </div>
          </Reveal>

          {/* Stats */}
          <Reveal delay={0.32} className="mt-16 w-full max-w-3xl">
            <dl className="glass grid grid-cols-3 divide-x divide-border rounded-2xl py-6 shadow-elevated inset-shadow-highlight">
              {[
                { icon: BookOpen, label: "Courses", value: stats.courses },
                { icon: Download, label: "Downloads", value: stats.downloads },
                { icon: FolderOpen, label: "Categories", value: stats.categories },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex flex-col items-center gap-1 px-2">
                  <Icon className="mb-1 h-5 w-5 text-primary" aria-hidden />
                  <dd className="text-2xl font-bold tabular-nums sm:text-3xl">
                    <AnimatedCounter value={value} />
                  </dd>
                  <dt className="text-xs text-muted-foreground sm:text-sm">{label}</dt>
                </div>
              ))}
            </dl>
          </Reveal>
        </Section>
      </div>

      {/* ---------- Categories ---------- */}
      {categories.length > 0 && (
        <Section className="py-14">
          <Reveal>
            <SectionHeading
              title="Browse by category"
              subtitle="Find courses in the field you want to master"
              href={categories.length > CATEGORY_GRID_LIMIT ? "/courses" : undefined}
              linkLabel="View all categories"
            />
          </Reveal>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {categories.slice(0, CATEGORY_GRID_LIMIT).map((category, i) => {
              const Icon = CATEGORY_ICONS[category.icon ?? ""] ?? BookOpen;
              return (
                <Reveal key={category.id} delay={i * 0.05}>
                  <Link
                    href={`/courses?category=${category.slug}`}
                    className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5 text-center shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-elevated"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-white group-hover:shadow-md group-hover:shadow-primary/30">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="text-sm leading-tight font-semibold">{category.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {category._count.courses} courses
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </Section>
      )}

      {/* ---------- Featured ---------- */}
      {featured.length > 0 && (
        <Section className="py-14">
          <Reveal>
            <SectionHeading
              title="Featured courses"
              subtitle="Hand-picked by our team"
              href="/courses"
            />
          </Reveal>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((course, i) => (
              <Reveal key={course.id} delay={Math.min(i * 0.06, 0.3)}>
                <CourseCard course={course} priority={i < 3} />
              </Reveal>
            ))}
          </div>
        </Section>
      )}

      {/* ---------- Trending ---------- */}
      {trending.length > 0 && (
        <Section className="py-14">
          <Reveal>
            <SectionHeading
              title="Trending now"
              subtitle="What everyone is downloading this week"
              href="/courses?sort=popular"
            />
          </Reveal>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {trending.map((course, i) => (
              <Reveal key={course.id} delay={Math.min(i * 0.06, 0.3)}>
                <CourseCard course={course} />
              </Reveal>
            ))}
          </div>
        </Section>
      )}

      {/* ---------- Most downloaded ---------- */}
      {mostDownloaded.length > 0 && (
        <Section className="py-14">
          <Reveal>
            <SectionHeading
              title="Most downloaded"
              subtitle="All-time community favorites"
              href="/courses?sort=popular"
            />
          </Reveal>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {mostDownloaded.map((course, i) => (
              <Reveal key={course.id} delay={Math.min(i * 0.06, 0.3)}>
                <CourseCard course={course} />
              </Reveal>
            ))}
          </div>
        </Section>
      )}

      {/* ---------- Recently added ---------- */}
      {recent.length > 0 && (
        <Section className="py-14">
          <Reveal>
            <SectionHeading
              title="Recently added"
              subtitle="Fresh courses, updated regularly"
              href="/courses?sort=newest"
            />
          </Reveal>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {recent.map((course, i) => (
              <Reveal key={course.id} delay={Math.min(i * 0.05, 0.3)}>
                <CourseCard course={course} />
              </Reveal>
            ))}
          </div>
        </Section>
      )}

      {/* ---------- Value props ---------- */}
      <Section className="py-14">
        <div className="glass bg-aurora grid gap-8 rounded-3xl p-8 shadow-elevated inset-shadow-highlight sm:grid-cols-3 sm:p-12">
          {[
            {
              icon: Zap,
              title: "Fast downloads",
              text: "Every course goes through a quick, protected download flow — no signup required.",
            },
            {
              icon: ShieldCheck,
              title: "Verified content",
              text: "Courses are checked and organized by category so you always know what you get.",
            },
            {
              icon: Sparkles,
              title: "Always free",
              text: "Every course on this platform is free to download. Forever.",
            },
          ].map(({ icon: Icon, title, text }, i) => (
            <Reveal key={title} delay={i * 0.08}>
              <div className="flex flex-col items-start gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>
    </>
  );
}
