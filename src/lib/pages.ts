/**
 * Registry of the site's standalone (admin-editable) pages.
 * Each page lives in the `pages` table keyed by slug; content is Markdown.
 * Adding an entry here makes it editable in Admin → Pages and rendered at
 * its public path (how-to-download and contact have their own dedicated routes).
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

/** Pages linked from the footer's legal row (all except how-to-download). */
export const GENERIC_PAGES = STANDALONE_PAGES.filter((p) => p.slug !== "how-to-download");

/** Pages rendered by the generic /(site)/[slug] route. Contact has a dedicated route. */
export const SLUG_ROUTE_PAGES = GENERIC_PAGES.filter((p) => p.slug !== "contact");

/**
 * Business contact address. Inbound only: it is a Cloudflare Email Routing
 * forward, so there is no outgoing mail server behind it and the site links to
 * it with mailto: rather than sending anything itself.
 */
export const CONTACT_EMAIL = "founder@courses.monster";

export function getPageMeta(slug: string): StandalonePage | undefined {
  return STANDALONE_PAGES.find((p) => p.slug === slug);
}
