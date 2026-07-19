import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import {
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  Eye,
  Film,
  Globe2,
  GraduationCap,
  HardDrive,
  HelpCircle,
  Send,
  UserRound,
} from "lucide-react";
import { db } from "@/lib/db";
import { getPublishedCourse, getRelatedCourses } from "@/lib/courses";
import { getSiteSettings } from "@/lib/settings";
import { absoluteUrl, formatDate, formatNumber, safeJsonLd } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CourseImage } from "@/components/site/course-image";
import { CourseCard } from "@/components/site/course-card";
import { Markdown } from "@/components/site/markdown";
import { Section, SectionHeading } from "@/components/site/section";

interface Props {
  params: Promise<{ slug: string }>;
}

const SKILL_LABELS: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

function formatDuration(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded} hours`;
}

/** ISO-8601 duration for JSON-LD, e.g. 4.5 → PT4H30M. */
function isoDuration(hours: number): string {
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  return minutes > 0 ? `PT${whole}H${minutes}M` : `PT${whole}H`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const course = await getPublishedCourse(slug);
  if (!course) return { title: "Course not found" };

  const title = course.seoTitle || course.title;
  const description =
    course.seoDescription || course.shortDescription || course.title;
  const image = course.metaImage || course.banner || course.thumbnail;

  return {
    title,
    description,
    alternates: { canonical: `/courses/${course.slug}` },
    openGraph: {
      title,
      description,
      type: "article",
      url: absoluteUrl(`/courses/${course.slug}`),
      ...(image ? { images: [{ url: absoluteUrl(image) }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(image ? { images: [absoluteUrl(image)] } : {}),
    },
  };
}

export default async function CoursePage({ params }: Props) {
  const { slug } = await params;
  const [course, settings] = await Promise.all([getPublishedCourse(slug), getSiteSettings()]);
  if (!course) notFound();

  // Count the view without delaying the response.
  after(async () => {
    await db.course
      .update({ where: { id: course.id }, data: { views: { increment: 1 } } })
      .catch(() => undefined);
  });

  const related = await getRelatedCourses(course);
  const telegramUrl = course.telegramUrl || settings.telegramUrl;

  // Facts card rows — only facts that actually have data.
  const facts: { label: string; value: string }[] = [
    ...(course.skillLevel ? [{ label: "Skill level", value: SKILL_LABELS[course.skillLevel]! }] : []),
    ...(course.language ? [{ label: "Language", value: course.language }] : []),
    ...(course.durationHours && course.durationHours > 0
      ? [{ label: "Duration", value: formatDuration(course.durationHours) }]
      : []),
    ...(course.lecturesCount && course.lecturesCount > 0
      ? [{ label: "Lectures", value: String(course.lecturesCount) }]
      : []),
    ...(course.sizeLabel ? [{ label: "Size", value: course.sizeLabel }] : []),
    ...(course.certificate != null
      ? [{ label: "Certificate", value: course.certificate ? "Yes" : "No" }]
      : []),
    ...(course.lifetimeAccess != null
      ? [{ label: "Lifetime access", value: course.lifetimeAccess ? "Yes" : "No" }]
      : []),
    ...(course.instructor ? [{ label: "Instructor", value: course.instructor }] : []),
    ...(course.publisher ? [{ label: "Publisher", value: course.publisher }] : []),
    { label: "Last updated", value: formatDate(course.contentUpdatedAt) },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.shortDescription || course.seoDescription || course.title,
    url: absoluteUrl(`/courses/${course.slug}`),
    isAccessibleForFree: true,
    dateModified: course.contentUpdatedAt.toISOString(),
    ...(course.thumbnail ? { image: absoluteUrl(course.thumbnail) } : {}),
    ...(course.tags.length ? { keywords: course.tags.join(", ") } : {}),
    ...(course.skillLevel ? { educationalLevel: SKILL_LABELS[course.skillLevel] } : {}),
    ...(course.language ? { inLanguage: course.language } : {}),
    ...(course.durationHours ? { timeRequired: isoDuration(course.durationHours) } : {}),
    ...(course.learningOutcomes.length ? { teaches: course.learningOutcomes } : {}),
    ...(course.prerequisites.length
      ? { coursePrerequisites: course.prerequisites.join("; ") }
      : {}),
    ...(course.publisher ? { publisher: { "@type": "Organization", name: course.publisher } } : {}),
    provider: {
      "@type": "Organization",
      name: settings.siteName,
      url: absoluteUrl(),
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    ...(course.lecturesCount || course.instructor
      ? {
          hasCourseInstance: {
            "@type": "CourseInstance",
            courseMode: "online",
            ...(course.lecturesCount
              ? { courseWorkload: `${course.lecturesCount} lectures` }
              : {}),
            ...(course.instructor
              ? { instructor: { "@type": "Person", name: course.instructor } }
              : {}),
          },
        }
      : {}),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl() },
      { "@type": "ListItem", position: 2, name: "Courses", item: absoluteUrl("/courses") },
      { "@type": "ListItem", position: 3, name: course.title },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd([jsonLd, breadcrumbLd]) }}
      />

      {/* Banner */}
      <div className="relative h-56 w-full overflow-hidden sm:h-72 lg:h-80">
        <CourseImage src={course.banner || course.thumbnail} title={course.title} priority />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>

      <Section className="relative -mt-24 pb-28 lg:pb-16">
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <li>
              <Link href="/" className="hover:text-primary">
                Home
              </Link>
            </li>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            <li>
              <Link href="/courses" className="hover:text-primary">
                Courses
              </Link>
            </li>
            {course.category && (
              <>
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                <li>
                  <Link href={`/courses?category=${course.category.slug}`} className="hover:text-primary">
                    {course.category.name}
                  </Link>
                </li>
              </>
            )}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            <li aria-current="page" className="max-w-48 truncate font-medium text-foreground sm:max-w-72">
              {course.title}
            </li>
          </ol>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
          {/* Main column */}
          <article>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {course.category && <Badge>{course.category.name}</Badge>}
              {course.skillLevel && (
                <Badge variant="outline">{SKILL_LABELS[course.skillLevel]}</Badge>
              )}
              {course.featured && <Badge variant="success">Featured</Badge>}
              {course.trending && <Badge variant="warning">Trending</Badge>}
              {course.popular && <Badge>Popular</Badge>}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
              {course.title}
            </h1>
            {course.shortDescription && (
              <p className="mt-3 text-lg text-muted-foreground">{course.shortDescription}</p>
            )}

            <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {course.instructor && (
                <div className="flex items-center gap-1.5">
                  <UserRound className="h-4 w-4 text-primary" aria-hidden />
                  <dt className="sr-only">Instructor</dt>
                  <dd>{course.instructor}</dd>
                </div>
              )}
              {course.language && (
                <div className="flex items-center gap-1.5">
                  <Globe2 className="h-4 w-4 text-primary" aria-hidden />
                  <dt className="sr-only">Language</dt>
                  <dd>{course.language}</dd>
                </div>
              )}
              {course.durationHours != null && course.durationHours > 0 && (
                <div className="flex items-center gap-1.5">
                  <Clock3 className="h-4 w-4 text-primary" aria-hidden />
                  <dt className="sr-only">Duration</dt>
                  <dd>{formatDuration(course.durationHours)}</dd>
                </div>
              )}
              {course.lecturesCount != null && course.lecturesCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <Film className="h-4 w-4 text-primary" aria-hidden />
                  <dt className="sr-only">Lectures</dt>
                  <dd>{course.lecturesCount} lectures</dd>
                </div>
              )}
              {course.sizeLabel && (
                <div className="flex items-center gap-1.5">
                  <HardDrive className="h-4 w-4 text-primary" aria-hidden />
                  <dt className="sr-only">Size</dt>
                  <dd>{course.sizeLabel}</dd>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-primary" aria-hidden />
                <dt className="sr-only">Last updated</dt>
                <dd>Updated {formatDate(course.contentUpdatedAt)}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <Download className="h-4 w-4 text-primary" aria-hidden />
                <dt className="sr-only">Downloads</dt>
                <dd>{formatNumber(course.downloads)} downloads</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <Eye className="h-4 w-4 text-primary" aria-hidden />
                <dt className="sr-only">Views</dt>
                <dd>{formatNumber(course.views)} views</dd>
              </div>
            </dl>

            {course.tags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {course.tags.map((tag) => (
                  <Link key={tag} href={`/courses?tag=${encodeURIComponent(tag)}`}>
                    <Badge variant="outline" className="hover:border-primary/50 hover:text-primary">
                      #{tag}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}

            {course.learningOutcomes.length > 0 && (
              <section className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-soft">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <BookOpenCheck className="h-5 w-5 text-primary" aria-hidden />
                  What you&apos;ll learn
                </h2>
                <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                  {course.learningOutcomes.map((outcome) => (
                    <li key={outcome} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                      <span>{outcome}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {course.prerequisites.length > 0 && (
              <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <GraduationCap className="h-5 w-5 text-primary" aria-hidden />
                  Prerequisites
                </h2>
                <ul className="space-y-2">
                  {course.prerequisites.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm">
                      <span
                        aria-hidden
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="mt-10">
              <Markdown content={course.description} />
            </div>
          </article>

          {/* Sidebar */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="glass overflow-hidden rounded-2xl shadow-elevated inset-shadow-highlight">
              <div className="aspect-video overflow-hidden">
                <CourseImage src={course.thumbnail} title={course.title} />
              </div>
              <div className="space-y-3 p-5">
                <p className="text-center text-2xl font-extrabold text-success">100% Free</p>
                <Link
                  href={`/download/${course.slug}`}
                  className={buttonClasses("primary", "lg", "w-full")}
                >
                  <Download className="h-5 w-5" aria-hidden />
                  Download course
                </Link>
                {telegramUrl && (
                  <a
                    href={telegramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClasses("secondary", "lg", "w-full")}
                  >
                    <Send className="h-4 w-4" aria-hidden />
                    Get on Telegram
                  </a>
                )}
                <Link
                  href="/how-to-download"
                  className={buttonClasses("ghost", "md", "w-full text-muted-foreground")}
                >
                  <HelpCircle className="h-4 w-4" aria-hidden />
                  How to download?
                </Link>

                {/* Course facts */}
                <dl className="space-y-2 border-t border-border pt-4 text-sm">
                  {facts.map(({ label, value }) => (
                    <div key={label} className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="text-right font-medium">{value}</dd>
                    </div>
                  ))}
                  {course.sourceUrl && (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted-foreground">Source</dt>
                      <dd>
                        <a
                          href={course.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                        >
                          Official page
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </aside>
        </div>

        {related.length > 0 && (
          <div className="mt-20">
            <SectionHeading title="Related courses" subtitle="You might also like these" />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* Mobile sticky download bar — the sidebar CTA is below the fold on phones. */}
      <div className="glass fixed inset-x-0 bottom-0 z-30 border-x-0 border-b-0 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden">
        <Link
          href={`/download/${course.slug}`}
          className={buttonClasses("primary", "lg", "w-full")}
        >
          <Download className="h-5 w-5" aria-hidden />
          Download course — 100% free
        </Link>
      </div>
    </>
  );
}
