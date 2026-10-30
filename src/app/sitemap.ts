import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { GENERIC_PAGES } from "@/lib/pages";
import { absoluteUrl } from "@/lib/utils";

export const revalidate = 3600;

/**
 * Per-section cap on enumerated rows.
 *
 * Two reasons this exists. The protocol limits a single sitemap to 50,000 URLs
 * and 50MB — past either, crawlers reject the whole file, so an uncapped sitemap
 * fails *completely* rather than gracefully. And each list is otherwise a full
 * table scan materialised in Node on a cache miss.
 *
 * `requests` and `resources` were already capped at 5000; courses, categories,
 * channels and apps were not, which looks like an oversight rather than a
 * decision — six sections at 5000 each stays comfortably inside the limit. If
 * any section genuinely approaches this, the fix is to split into a sitemap
 * index with one child per section, not to raise the cap.
 */
const SECTION_LIMIT = 5000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // One round trip's worth of latency, not six. These queries are independent
  // and were previously awaited one after another.
  const [courses, categories, requests, channels, resources, apps] = await Promise.all([
    db.course.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
      take: SECTION_LIMIT,
    }),
    db.category.findMany({
      where: { courses: { some: { published: true } } },
      select: { slug: true, updatedAt: true },
      take: SECTION_LIMIT,
    }),
    db.courseRequest.findMany({
      where: { moderationStatus: "VISIBLE" },
      select: { slug: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
      take: SECTION_LIMIT,
    }),
    db.codingChannel.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
      take: SECTION_LIMIT,
    }),
    db.learningResource.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
      take: SECTION_LIMIT,
    }),
    db.appListing.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
      take: SECTION_LIMIT,
    }),
  ]);

  return [
    { url: absoluteUrl(), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/courses"), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/requests"), changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl("/coding-channels"), changeFrequency: "weekly", priority: 0.7 },
    { url: absoluteUrl("/learn"), changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl("/apps"), changeFrequency: "weekly", priority: 0.7 },
    /**
     * Section index only. Free Resources and Free AI Platforms have no
     * per-row detail pages by design (see the schema comment), so there is
     * nothing else here to enumerate — and filter permutations deliberately
     * stay out, since they all share the section's canonical URL.
     */
    { url: absoluteUrl("/free-resources"), changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/ai-platforms"), changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/how-to-download"), changeFrequency: "monthly", priority: 0.5 },
    ...GENERIC_PAGES.map((p) => ({
      url: absoluteUrl(p.path),
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
    ...categories.map((c) => ({
      url: absoluteUrl(`/courses?category=${c.slug}`),
      lastModified: c.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...courses.map((c) => ({
      url: absoluteUrl(`/courses/${c.slug}`),
      lastModified: c.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...requests.map((r) => ({
      url: absoluteUrl(`/requests/${r.slug}`),
      lastModified: r.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...channels.map((c) => ({
      url: absoluteUrl(`/coding-channels/${c.slug}`),
      lastModified: c.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...resources.map((r) => ({
      url: absoluteUrl(`/learn/${r.slug}`),
      lastModified: r.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...apps.map((a) => ({
      url: absoluteUrl(`/apps/${a.slug}`),
      lastModified: a.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
