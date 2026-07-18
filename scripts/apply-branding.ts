/**
 * One-shot script: applies the Courses Monster branding to the settings row,
 * validated through the same schema the admin panel uses.
 * Run: set -a; . ./.env; set +a; npx tsx scripts/apply-branding.ts
 */
import { PrismaClient } from "@prisma/client";
import { SETTINGS_KEY, siteSettingsSchema } from "../src/lib/settings-schema";

const db = new PrismaClient();

const metaDescription =
  "Download premium courses for free at Courses Monster — programming, AI, design, marketing & business. Curated online learning to build real skills.";

const settings = siteSettingsSchema.parse({
  siteName: "Courses Monster",
  tagline: "A monster library of free premium courses",
  description:
    "Browse and download hand-picked premium courses on programming, AI, design, marketing and business — 100% free, organized by category and updated regularly.",
  logoUrl: "/uploads/logo-coursesmonster.png",
  faviconUrl: "/uploads/favicon-coursesmonster.png",
  telegramUrl: "https://t.me/Unique_One_in",
  social: {
    youtube: "https://youtube.com/@notmasterpiece-9?si=CrciphJg2MaZTqzT",
  },
  footerText:
    "Courses Monster is a free learning library — download hand-picked premium courses on programming, AI, design, marketing and business at no cost. All content is shared for educational purposes, helping everyone build real-world skills.",
  seo: {
    defaultTitle: "Courses Monster — Download Free Premium Courses",
    titleTemplate: "%s | Courses Monster",
    defaultDescription: metaDescription,
    metaImageUrl: "/uploads/og-coursesmonster.png",
  },
  newsletterEnabled: true,
  downloadCountdownSeconds: 3,
  theme: { defaultMode: "system" },
});

async function main() {
  console.log(`meta description length: ${metaDescription.length} chars`);
  await db.setting.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: settings },
    update: { value: settings },
  });
  console.log("branding applied ✓");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
