/**
 * Registry of the site's standalone (admin-editable) pages.
 * Each page lives in the `pages` table keyed by slug; content is Markdown.
 * Adding an entry to STANDALONE_PAGES makes it editable in Admin → Pages.
 */
export const STANDALONE_PAGES = [
  {
    slug: "how-to-download",
    title: "How to Download",
    path: "/how-to-download",
    description: "Step-by-step guide to downloading any course from this site.",
  },
] as const;

export type StandalonePage = (typeof STANDALONE_PAGES)[number];
export type PageSlug = StandalonePage["slug"];

export const PAGE_SLUGS = STANDALONE_PAGES.map((p) => p.slug) as [PageSlug, ...PageSlug[]];

/**
 * Legal and contact pages. Written in code (src/lib/legal-content.ts), not in
 * the admin-editable `pages` table: they state the payment, refund and
 * privacy terms the checkout relies on, and the only contact they may show is
 * the SUPPORT_TELEGRAM handle — no email, phone or address.
 */
export const LEGAL_PAGES = [
  {
    slug: "terms",
    title: "Terms & Conditions",
    path: "/terms",
    description: "The terms that apply when you use Courses Monster and buy Premium.",
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    path: "/privacy",
    description: "What data Courses Monster collects, why, and how it is protected.",
  },
  {
    slug: "refund-policy",
    title: "Refund Policy",
    path: "/refund-policy",
    description: "All Courses Monster purchases are digital and non-refundable.",
  },
  {
    slug: "copyright",
    title: "Copyright & DMCA",
    path: "/copyright",
    description:
      "Copyright policy and takedown process for rights holders. How to report content and request removal.",
  },
  {
    slug: "contact",
    title: "Contact Us",
    path: "/contact",
    description: "How to reach the Courses Monster team on Telegram.",
  },
] as const;

export type LegalPage = (typeof LEGAL_PAGES)[number];

/** Pages linked from the footer's legal row and listed in the sitemap. */
export const GENERIC_PAGES = LEGAL_PAGES;

export function getPageMeta(slug: string): StandalonePage | LegalPage | undefined {
  return [...STANDALONE_PAGES, ...LEGAL_PAGES].find((p) => p.slug === slug);
}
