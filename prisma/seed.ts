import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { defaultSiteSettings, SETTINGS_KEY } from "../src/lib/settings-schema";

const db = new PrismaClient();

const categories = [
  { slug: "web-development", name: "Web Development", icon: "code", description: "Frontend, backend and full-stack engineering." },
  { slug: "design", name: "Design", icon: "palette", description: "UI/UX, product and graphic design." },
  { slug: "data-science", name: "Data Science", icon: "bar-chart", description: "Analytics, machine learning and AI." },
  { slug: "marketing", name: "Marketing", icon: "megaphone", description: "SEO, content and growth marketing." },
  { slug: "business", name: "Business", icon: "briefcase", description: "Entrepreneurship, finance and management." },
  { slug: "mobile-development", name: "Mobile Development", icon: "smartphone", description: "iOS, Android and cross-platform apps." },
];

type SeedCourse = {
  slug: string;
  title: string;
  shortDescription: string;
  category: string;
  tags: string[];
  sizeLabel: string;
  lecturesCount: number;
  featured?: boolean;
  trending?: boolean;
};

const courses: SeedCourse[] = [
  { slug: "modern-react-with-nextjs", title: "Modern React with Next.js", shortDescription: "Build production-grade React apps with the App Router, server components and streaming.", category: "web-development", tags: ["react", "nextjs", "typescript"], sizeLabel: "8.4 GB", lecturesCount: 214, featured: true, trending: true },
  { slug: "typescript-from-zero-to-hero", title: "TypeScript from Zero to Hero", shortDescription: "Master the type system, generics, and advanced patterns used in real codebases.", category: "web-development", tags: ["typescript", "javascript"], sizeLabel: "3.1 GB", lecturesCount: 128, featured: true },
  { slug: "nodejs-backend-masterclass", title: "Node.js Backend Masterclass", shortDescription: "REST, authentication, testing and deployment with Node.js and PostgreSQL.", category: "web-development", tags: ["nodejs", "api", "postgresql"], sizeLabel: "6.7 GB", lecturesCount: 182, trending: true },
  { slug: "figma-ui-design-bootcamp", title: "Figma UI Design Bootcamp", shortDescription: "Design systems, auto layout, prototyping and developer hand-off in Figma.", category: "design", tags: ["figma", "ui", "design-systems"], sizeLabel: "4.2 GB", lecturesCount: 96, featured: true },
  { slug: "ux-research-fundamentals", title: "UX Research Fundamentals", shortDescription: "Interviews, usability testing and turning insights into product decisions.", category: "design", tags: ["ux", "research"], sizeLabel: "2.3 GB", lecturesCount: 64 },
  { slug: "python-for-data-science", title: "Python for Data Science", shortDescription: "NumPy, pandas, visualization and practical statistics for analysts.", category: "data-science", tags: ["python", "pandas", "statistics"], sizeLabel: "5.9 GB", lecturesCount: 156, featured: true, trending: true },
  { slug: "machine-learning-a-to-z", title: "Machine Learning A to Z", shortDescription: "Supervised and unsupervised learning with scikit-learn and real datasets.", category: "data-science", tags: ["ml", "python", "scikit-learn"], sizeLabel: "9.8 GB", lecturesCount: 240, trending: true },
  { slug: "seo-mastery-2026", title: "SEO Mastery 2026", shortDescription: "Technical SEO, content strategy and link building that actually ranks.", category: "marketing", tags: ["seo", "content"], sizeLabel: "1.9 GB", lecturesCount: 72 },
  { slug: "social-media-growth-engine", title: "Social Media Growth Engine", shortDescription: "Build an audience with organic content systems across platforms.", category: "marketing", tags: ["social-media", "growth"], sizeLabel: "2.8 GB", lecturesCount: 88, trending: true },
  { slug: "startup-finance-essentials", title: "Startup Finance Essentials", shortDescription: "Runway, unit economics and fundraising explained for founders.", category: "business", tags: ["finance", "startup"], sizeLabel: "1.4 GB", lecturesCount: 48 },
  { slug: "flutter-complete-guide", title: "Flutter Complete Guide", shortDescription: "Ship beautiful cross-platform apps with Flutter and Dart.", category: "mobile-development", tags: ["flutter", "dart", "mobile"], sizeLabel: "7.2 GB", lecturesCount: 198, featured: true },
  { slug: "swiftui-ios-development", title: "SwiftUI iOS Development", shortDescription: "Modern iOS apps with SwiftUI, Combine and Swift concurrency.", category: "mobile-development", tags: ["swift", "ios"], sizeLabel: "5.1 GB", lecturesCount: 142 },
];

function description(c: SeedCourse): string {
  return `## What you'll learn

${c.shortDescription}

This course takes you from fundamentals to advanced, production-ready skills through hands-on projects and real-world examples.

## Course content

- **${c.lecturesCount} lectures** of on-demand video
- Downloadable resources and source code
- Practical projects you can add to your portfolio
- Lifetime access to all future updates

## Requirements

- A computer with an internet connection
- No prior experience required — everything is taught from scratch

## Who this course is for

Anyone who wants to learn ${c.tags.join(", ")} with a structured, project-based approach.`;
}

const howToDownload = `## How to download courses

Follow these simple steps to download any course on this site.

### Step 1 — Open the course page

Browse or search for the course you want and open its page.

### Step 2 — Click the Download button

You'll be taken to a protected download page on this site.

### Step 3 — Complete the verification

Wait for the short countdown and complete the captcha. This keeps the site free for everyone by preventing abuse and bots.

### Step 4 — Continue through the link page

After verification you'll be redirected through our link page. Follow the steps shown there to reach the final download.

### Step 5 — Download your course

You'll land on the download destination where the course files are hosted. Save them to your device and start learning!

---

**Having trouble?** Join our Telegram channel from the header for help and course requests.`;

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "ChangeMe_Admin123!";

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await db.user.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail, name: "Admin", passwordHash, role: "ADMIN" },
    update: {},
  });
  console.log(`Admin user ready: ${adminEmail}`);

  await db.setting.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: defaultSiteSettings },
    update: {},
  });

  await db.page.upsert({
    where: { slug: "how-to-download" },
    create: { slug: "how-to-download", title: "How to Download", content: howToDownload },
    update: {},
  });

  for (const [i, c] of categories.entries()) {
    await db.category.upsert({
      where: { slug: c.slug },
      create: { ...c, order: i },
      update: { name: c.name, description: c.description, icon: c.icon, order: i },
    });
  }
  console.log(`Seeded ${categories.length} categories`);

  const categoryIds = new Map(
    (await db.category.findMany()).map((c) => [c.slug, c.id])
  );

  for (const [i, c] of courses.entries()) {
    const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
    await db.course.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        title: c.title,
        shortDescription: c.shortDescription,
        description: description(c),
        categoryId: categoryIds.get(c.category) ?? null,
        tags: c.tags,
        downloadUrl: `https://example.com/downloads/${c.slug}`,
        telegramUrl: null,
        sizeLabel: c.sizeLabel,
        lecturesCount: c.lecturesCount,
        published: true,
        featured: c.featured ?? false,
        trending: c.trending ?? false,
        order: i,
        views: 500 + Math.floor(Math.random() * 20000),
        downloads: 100 + Math.floor(Math.random() * 5000),
        contentUpdatedAt: daysAgo(1 + Math.floor(Math.random() * 60)),
        createdAt: daysAgo(2 + Math.floor(Math.random() * 120)),
      },
      update: {},
    });
  }
  console.log(`Seeded ${courses.length} courses`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
