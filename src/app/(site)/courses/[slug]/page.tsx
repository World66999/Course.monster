import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Crown,
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
import { getPublishedCourse, getRelatedCourses } from "@/lib/courses";
import { getSiteSettings } from "@/lib/settings";
import { absoluteUrl, formatDate, formatNumber, safeJsonLd } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CourseImage } from "@/components/site/course-image";
import { CourseCard } from "@/components/site/course-card";
import { Markdown } from "@/components/site/markdown";
import { Section, SectionHeading } from "@/components/site/section";
import { PremiumCtaBand } from "@/components/premium/cta-band";
import { ReviewsSection } from "@/components/site/reviews/reviews-section";
import { CourseViewBeacon } from "@/components/site/view-beacon";

interface Props {
  params: Promise<{ slug: string }>;
}

/**
 * Cached (ISR) and identical for every visitor. Nothing on this page reads the
 * session any more: the viewer's own review and comment likes are fetched on
 * the client, and the view count comes from a beacon. Admin edits revalidate
 * the whole site; review/comment writes revalidate this path
 * (server/revalidate-course.ts); 120s bounds anything else, like like-counts.
 */
export const revalidate = 120;

/** No pages are pre-built; each course is cached on its first request. */
export function generateStaticParams() {
  return [];
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

  const related = await getRelatedCourses(course);
  const telegramUrl = course.telegramUrl || settings.telegramUrl;
  // Deep link straight to this course in the bot. Uses the public slug (never a
  // database id) and stays inside Telegram's 64-char start-parameter limit.
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT ?? "";
  const botCourseUrl =
    botUsername && /^[a-z0-9-]{1,64}$/.test(course.slug)
      ? `https://t.me/${botUsername}?start=${course.slug}`
      : botUsername
        ? `https://t.me/${botUsername}`
        : "";

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
    // Only ever emitted with real reviews behind it — no thin/fake structured data.
    ...(course.reviewCount > 0 && course.avgRating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: course.avgRating.toFixed(1),
            reviewCount: course.reviewCount,
            bestRating: 5,
            worstRating: 1,
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
      <CourseViewBeacon slug={course.slug} />

      {/* Banner */}
      <div className="relative h-56 w-full overflow-hidden sm:h-72 lg:h-80">
        <CourseImage src={course.banner || course.thumbnail} title={course.title} priority />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>

      <Section className="relative -mt-24 pb-28 lg:pb-16">
        {/* Sits over the bottom of the banner, so it gets its own opaque
            backing (no blur) to stay legible on any artwork. Separators live
            inside the <li>s: an <ol> may only contain list items. */}
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full bg-background/90 px-3.5 py-1.5 text-sm text-muted-foreground shadow-soft ring-1 ring-border/60">
            <li>
              <Link href="/" className="hover:text-primary">
                Home
              </Link>
            </li>
            <li className="flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              <Link href="/courses" className="hover:text-primary">
                Courses
              </Link>
            </li>
            {course.category && (
              <li className="flex items-center gap-1.5">
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                <Link href={`/courses?category=${course.category.slug}`} className="hover:text-primary">
                  {course.category.name}
                </Link>
              </li>
            )}
            <li aria-current="page" className="flex min-w-0 items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="max-w-40 truncate font-medium text-foreground sm:max-w-72">{course.title}</span>
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
            <h1 className="text-title text-balance">
              {course.title}
            </h1>
            {course.shortDescription && (
              <p className="mt-4 max-w-2xl text-lead text-pretty text-muted-foreground">{course.shortDescription}</p>
            )}

            <dl className="numeric mt-7 flex flex-wrap gap-x-6 gap-y-2.5 text-sm text-muted-foreground">
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
              <section className="mt-10 rounded-card border border-border bg-card p-6 shadow-soft sm:p-7">
                <h2 className="mb-5 flex items-center gap-2.5 text-subheading">
                  <BookOpenCheck className="h-5 w-5 text-primary" aria-hidden />
                  What you&apos;ll learn
                </h2>
                <ul className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
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
              <section className="mt-6 rounded-card border border-border bg-card p-6 shadow-soft sm:p-7">
                <h2 className="mb-5 flex items-center gap-2.5 text-subheading">
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
            <div className="glass-panel edge-gradient overflow-hidden rounded-panel">
              <div className="aspect-video overflow-hidden">
                <CourseImage src={course.thumbnail} title={course.title} />
              </div>
              <div className="space-y-3 p-5">
                {course.premium ? (
                  <p className="flex items-center justify-center gap-2 text-2xl font-extrabold text-gold-ink">
                    <Crown className="h-6 w-6" aria-hidden /> Premium course
                  </p>
                ) : (
                  <p className="text-center text-2xl font-extrabold text-success">100% Free</p>
                )}
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
                {botCourseUrl && (
                  <a
                    href={botCourseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClasses("ghost", "lg", "w-full")}
                  >
                    <Send className="h-4 w-4" aria-hidden />
                    Open in Course Bot
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

        <PremiumCtaBand className="mt-16" />

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

      <div className="border-t border-border pb-28 lg:pb-0">
        <ReviewsSection courseId={course.id} />
      </div>

      {/* Mobile sticky download bar — the sidebar CTA is below the fold on phones.
          Horizontal insets as well as the bottom one: with `viewport-fit=cover`
          set in the root layout, a notched iPhone held in landscape puts the notch
          over this bar's leading edge, and a flat 12px gutter let the button slide
          under it. */}
      <div className="surface fixed inset-x-0 bottom-0 z-30 border-x-0 border-b-0 py-3 pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))] pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden">
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
