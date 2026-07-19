import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import {
  CalendarDays,
  ChevronRight,
  Download,
  Eye,
  Film,
  HardDrive,
  HelpCircle,
  Send,
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.shortDescription || course.seoDescription || course.title,
    url: absoluteUrl(`/courses/${course.slug}`),
    ...(course.thumbnail ? { image: absoluteUrl(course.thumbnail) } : {}),
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
    ...(course.lecturesCount
      ? {
          hasCourseInstance: {
            "@type": "CourseInstance",
            courseMode: "online",
            courseWorkload: `${course.lecturesCount} lectures`,
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

      <Section className="relative -mt-24 pb-16">
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
              {course.featured && <Badge variant="success">Featured</Badge>}
              {course.trending && <Badge variant="warning">Trending</Badge>}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
              {course.title}
            </h1>
            {course.shortDescription && (
              <p className="mt-3 text-lg text-muted-foreground">{course.shortDescription}</p>
            )}

            <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
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
    </>
  );
}
