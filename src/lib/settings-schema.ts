import { z } from "zod";

const optionalUrl = z
  .union([z.string().url(), z.literal("")])
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
  logoUrl: optionalUrl,
  faviconUrl: optionalUrl,
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
      metaImageUrl: optionalUrl,
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
    .default("User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /go/\nDisallow: /download/"),
  theme: z
    .object({
      defaultMode: z.enum(["system", "dark", "light"]).default("system"),
    })
    .prefault({}),
  newsletterEnabled: z.boolean().default(true),
  downloadCountdownSeconds: z.number().int().min(0).max(60).default(3),
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export const defaultSiteSettings: SiteSettings = siteSettingsSchema.parse({});

export const SETTINGS_KEY = "site";
