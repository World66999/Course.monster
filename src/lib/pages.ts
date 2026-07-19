/**
 * Registry of the site's standalone (admin-editable) pages.
 * Each page lives in the `pages` table keyed by slug; content is Markdown.
 * Adding an entry here makes it editable in Admin → Pages and rendered at
 * its public path (how-to-download has its own dedicated route).
 */
export const STANDALONE_PAGES = [
  {
    slug: "how-to-download",
    title: "How to Download",
    path: "/how-to-download",
    description: "Step-by-step guide to downloading any course from this site.",
  },
  {
    slug: "copyright",
    title: "Copyright & DMCA",
    path: "/copyright",
    description:
      "Copyright policy and takedown process for rights holders. How to report content and request removal.",
  },
  {
    slug: "terms",
    title: "Terms of Use",
    path: "/terms",
    description: "The terms that apply when you use this website.",
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    path: "/privacy",
    description: "What data this website collects, why, and how it is protected.",
  },
  {
    slug: "contact",
    title: "Contact",
    path: "/contact",
    description: "How to reach the Courses Monster team, including for copyright matters.",
  },
] as const;

export type StandalonePage = (typeof STANDALONE_PAGES)[number];
export type PageSlug = StandalonePage["slug"];

export const PAGE_SLUGS = STANDALONE_PAGES.map((p) => p.slug) as [PageSlug, ...PageSlug[]];

/** Pages rendered by the generic /(site)/[slug] route (all except how-to-download). */
export const GENERIC_PAGES = STANDALONE_PAGES.filter((p) => p.slug !== "how-to-download");

export function getPageMeta(slug: string): StandalonePage | undefined {
  return STANDALONE_PAGES.find((p) => p.slug === slug);
}
