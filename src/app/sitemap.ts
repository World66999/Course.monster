import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { GENERIC_PAGES } from "@/lib/pages";
import { absoluteUrl } from "@/lib/utils";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const courses = await db.course.findMany({
    where: { published: true },
    select: { slug: true, updatedAt: true },
    orderBy: { createdAt: "desc" },
  });

  const categories = await db.category.findMany({ select: { slug: true, updatedAt: true } });

  return [
    { url: absoluteUrl(), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/courses"), changeFrequency: "daily", priority: 0.9 },
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
  ];
}
