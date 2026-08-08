import { z } from "zod";
import { isSafeExternalUrl, SAFE_URL_MESSAGE } from "@/lib/safe-url";

/**
 * These land in the header/footer/mobile-nav on every page, so a bare
 * `.url()` (which accepts `javascript:`) would be a stored XSS sink for all
 * visitors — see safe-url.ts.
 */
const optionalUrl = z
  .union([z.string().url().refine(isSafeExternalUrl, SAFE_URL_MESSAGE), z.literal("")])
  .optional()
  .default("");

/** Absolute URL or a local admin-uploaded image path. */
const imageRef = z
  .union([
    z.string().url().refine(isSafeExternalUrl, SAFE_URL_MESSAGE),
    z.string().regex(/^\/uploads\/[a-zA-Z0-9._-]+$/),
    z.literal(""),
  ])
  .optional()
  .default("");

export const siteSettingsSchema = z.object({
  siteName: z.string().min(1).max(60).default("CourseVault"),
  tagline: z.string().max(120).default("Premium courses, free for everyone"),
  description: z
    .string()
    .max(300)
    .default(
      "Browse, search and download hand-picked free courses on development, design, marketing and more."
    ),
  logoUrl: imageRef,
  faviconUrl: imageRef,
  announcement: z
    .object({
      enabled: z.boolean().default(false),
      text: z.string().max(200).default(""),
      linkUrl: optionalUrl,
      linkLabel: z.string().max(40).optional().default(""),
    })
    .prefault({}),
  telegramUrl: optionalUrl,
  social: z
    .object({
      twitter: optionalUrl,
      youtube: optionalUrl,
      github: optionalUrl,
      instagram: optionalUrl,
      facebook: optionalUrl,
      discord: optionalUrl,
    })
    .prefault({}),
  footerText: z
    .string()
    .max(400)
    .default("All courses listed are free to download. Built for learners, by learners."),
  seo: z
    .object({
      defaultTitle: z.string().max(70).default("CourseVault — Free Premium Courses"),
      titleTemplate: z.string().max(80).default("%s | CourseVault"),
      defaultDescription: z
        .string()
        .max(300)
        .default(
          "Download hand-picked free courses on development, design, marketing and more."
        ),
      metaImageUrl: imageRef,
      twitterHandle: z.string().max(30).optional().default(""),
    })
    .prefault({}),
  analytics: z
    .object({
      googleAnalyticsId: z
        .string()
        .max(30)
        .regex(/^$|^(G|UA|GT)-[A-Za-z0-9-]+$/, "Must look like G-XXXXXXX")
        .optional()
        .default(""),
    })
    .prefault({}),
  robotsTxt: z
    .string()
    .max(4000)
    // The admin panel is deliberately absent here: it lives at a secret path
    // that must never be published, and naming it would defeat the purpose.
    .default("User-agent: *\nAllow: /\nDisallow: /go/\nDisallow: /download/"),
  theme: z
    .object({
      defaultMode: z.enum(["system", "dark", "light"]).default("system"),
    })
    .prefault({}),
  newsletterEnabled: z.boolean().default(true),
  downloadCountdownSeconds: z.number().int().min(0).max(60).default(3),
  comments: z
    .object({
      enabled: z.boolean().default(true),
      minLength: z.number().int().min(1).max(500).default(2),
      maxLength: z.number().int().min(10).max(10_000).default(2000),
      reviewMaxLength: z.number().int().min(10).max(20_000).default(5000),
      /** Max comments/replies a single user may post within `rateLimitWindowMinutes`. */
      rateLimitCount: z.number().int().min(1).max(1000).default(20),
      rateLimitWindowMinutes: z.number().int().min(1).max(1440).default(60),
      /** Minimum seconds between two consecutive posts by the same user. */
      cooldownSeconds: z.number().int().min(0).max(3600).default(20),
      /** Window to check for the same user re-posting identical text. */
      duplicateWindowMinutes: z.number().int().min(1).max(1440).default(30),
      profanityFilterEnabled: z.boolean().default(true),
    })
    .prefault({}),
  chat: z
    .object({
      enabled: z.boolean().default(true),
      minLength: z.number().int().min(0).max(500).default(1),
      maxLength: z.number().int().min(10).max(4_000).default(1_000),
      /** Max messages a single user may post within `rateLimitWindowMinutes`. */
      rateLimitCount: z.number().int().min(1).max(2_000).default(60),
      rateLimitWindowMinutes: z.number().int().min(1).max(1440).default(60),
      /** Minimum seconds between two consecutive messages by the same user. */
      cooldownSeconds: z.number().int().min(0).max(3600).default(3),
      /** Window to check for the same user re-posting identical text. */
      duplicateWindowMinutes: z.number().int().min(1).max(1440).default(5),
      profanityFilterEnabled: z.boolean().default(true),
      /** Client polling interval while the chat panel is visible. */
      pollIntervalSeconds: z.number().int().min(2).max(60).default(4),
    })
    .prefault({}),
  courseRequests: z
    .object({
      enabled: z.boolean().default(true),
      descriptionMinLength: z.number().int().min(1).max(500).default(20),
      descriptionMaxLength: z.number().int().min(50).max(20_000).default(4_000),
      commentMinLength: z.number().int().min(1).max(500).default(2),
      commentMaxLength: z.number().int().min(10).max(10_000).default(2_000),
      /** Max requests/comments a single user may post within `rateLimitWindowMinutes`. */
      rateLimitCount: z.number().int().min(1).max(1000).default(20),
      rateLimitWindowMinutes: z.number().int().min(1).max(1440).default(60),
      /** Minimum seconds between two consecutive posts by the same user. */
      cooldownSeconds: z.number().int().min(0).max(3600).default(20),
      /** Window to check for the same user re-posting an identical request/comment. */
      duplicateWindowMinutes: z.number().int().min(1).max(1440).default(60),
      profanityFilterEnabled: z.boolean().default(true),
      /** Vote threshold at which a request additionally shows the "Popular" badge. */
      popularVoteThreshold: z.number().int().min(1).max(10_000).default(10),
    })
    .prefault({}),
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export const defaultSiteSettings: SiteSettings = siteSettingsSchema.parse({});

export const SETTINGS_KEY = "site";
