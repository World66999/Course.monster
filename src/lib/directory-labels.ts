/**
 * Display labels for the Free Resources and Free AI Platforms directories.
 *
 * Deliberately a plain, dependency-free module (no "server-only", no React) so
 * the public cards, the filter bars and the admin forms all read the *same*
 * strings. Adding an enum value means editing the Prisma enum, the Zod enum and
 * one map here — the components iterate these maps and need no change.
 *
 * This is what keeps the pricing wording out of the components: no JSX anywhere
 * spells out "free tier", so correcting how a platform's availability is
 * described is a data edit (change the row's pricingType) or a one-line edit
 * here, never a hunt through the frontend.
 */

/** Where the resource lives. Hostname-verified — see src/lib/external-resource.ts. */
export const RESOURCE_SOURCE_LABELS: Record<string, string> = {
  MEGA: "MEGA",
  TELEGRAM: "Telegram",
  GOOGLE_DRIVE: "Google Drive",
  GITHUB: "GitHub",
  DROPBOX: "Dropbox",
  ONEDRIVE: "OneDrive",
  YOUTUBE: "YouTube",
  ARCHIVE_ORG: "Internet Archive",
  WEBSITE: "Website",
};

/** What the resource is. Admin-chosen. */
export const RESOURCE_CATEGORY_LABELS: Record<string, string> = {
  DOCUMENTATION: "Documentation",
  COURSE: "Free Course",
  EBOOK: "Ebook / Notes",
  TOOL: "Tool",
  DATASET: "Dataset",
  CHEATSHEET: "Cheatsheet",
  COMMUNITY: "Community",
  OTHER: "Other",
};

export const AI_CATEGORY_LABELS: Record<string, string> = {
  CHAT: "AI Chat",
  CODING: "AI Coding",
  IMAGE: "Image Generation",
  VIDEO: "Video",
  WRITING: "Writing",
  RESEARCH: "Research",
  EDUCATION: "Education",
  PRODUCTIVITY: "Productivity",
  PRESENTATIONS: "Presentations",
  DESIGN: "Design",
  AUDIO: "Audio",
  OTHER: "Other",
};

/**
 * How a platform is free — worded so it cannot overstate the offer.
 *
 * There is no "free forever" / "100% free" label on purpose: this codebase
 * cannot verify a vendor's future pricing, so it must not print a promise a
 * student might plan around. The strongest claim available, FREE, says only
 * that it is free to use today.
 */
export const AI_PRICING_LABELS: Record<string, string> = {
  FREE: "Free to use",
  FREE_TIER: "Free tier available",
  FREE_PLAN_LIMITED: "Free plan with usage limits",
  FREE_TRIAL: "Free trial only",
  OPEN_SOURCE: "Open source / self-hostable",
};

/**
 * Badge tone per pricing type. FREE_TRIAL is warning-toned rather than green:
 * it is the one value that expires, and that is the case a student most needs
 * to notice before building a workflow around it.
 */
export const AI_PRICING_VARIANTS: Record<string, "success" | "default" | "warning" | "secondary"> = {
  FREE: "success",
  FREE_TIER: "default",
  FREE_PLAN_LIMITED: "default",
  FREE_TRIAL: "warning",
  OPEN_SOURCE: "success",
};

/** Safe lookup: an unmapped enum value degrades to itself, never to `undefined`. */
export function labelFor(map: Record<string, string>, key: string): string {
  return map[key] ?? key;
}
