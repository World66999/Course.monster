import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/**
 * Seeds the default Premium Resources categories. Idempotent: an existing
 * category (matched by slug) is left exactly as the admin last edited it, so
 * this is safe to re-run after renames or reordering in the admin panel.
 *
 *   npx tsx scripts/seed-premium-categories.ts
 */
const DEFAULTS: { slug: string; name: string; description: string; icon: string }[] = [
  {
    slug: "coding-help",
    name: "Coding Help & Solutions",
    description: "Worked solutions, debugging walkthroughs and code reviews.",
    icon: "code",
  },
  {
    slug: "ai-tools-mastery",
    name: "AI Tools Mastery",
    description: "Getting real work out of AI tools — through their official, legitimate plans and free tiers.",
    icon: "sparkles",
  },
  {
    slug: "github-projects",
    name: "GitHub Projects",
    description: "Hand-picked open-source projects worth studying, forking or using.",
    icon: "github",
  },
  {
    slug: "learning-resources",
    name: "Learning Resources",
    description: "Roadmaps, reading lists and the best free material per topic.",
    icon: "graduation",
  },
  {
    slug: "hidden-gems",
    name: "Hidden Gems",
    description: "Lesser-known tools and free alternatives to paid apps.",
    icon: "gem",
  },
  { slug: "more", name: "More", description: "Everything else members asked for.", icon: "layers" },
];

async function main() {
  let created = 0;
  for (const [order, c] of DEFAULTS.entries()) {
    const existing = await db.premiumCategory.findUnique({ where: { slug: c.slug }, select: { id: true } });
    if (existing) continue;
    await db.premiumCategory.create({ data: { ...c, order } });
    created++;
  }
  console.log(`Premium categories: ${created} created, ${DEFAULTS.length - created} already present.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
