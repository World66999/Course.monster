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

/**
 * The bootstrap admin's credentials, or a refusal to seed.
 *
 * This used to be `process.env.ADMIN_PASSWORD ?? "ChangeMe_Admin123!"`. `??`
 * only catches undefined — and `.env.example` ships `ADMIN_PASSWORD=""`, so
 * anyone following the documented setup got an ADMIN account whose password was
 * the empty string. Verified against a freshly seeded database:
 * `bcrypt.compare("", hash)` returned true. The fallback was no better: a
 * published constant is a known password on every deployment that skipped the
 * variable.
 *
 * Refusing outright is the only safe answer. There is no value this can pick on
 * the operator's behalf that is not either empty or public.
 */
function adminCredentials(): { email: string; password: string } {
  const email = (process.env.ADMIN_EMAIL ?? "").trim();
  const password = process.env.ADMIN_PASSWORD ?? "";

  const problems: string[] = [];
  if (!email) problems.push("ADMIN_EMAIL is empty");
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) problems.push(`ADMIN_EMAIL is not an email address: ${email}`);
  if (!password) problems.push("ADMIN_PASSWORD is empty");
  else if (password.length < 12) problems.push("ADMIN_PASSWORD is shorter than 12 characters");

  if (problems.length > 0) {
    console.error(
      "\nRefusing to seed an administrator:\n" +
        problems.map((p) => `  - ${p}`).join("\n") +
        "\n\nSet both in .env before running `npx prisma db seed`. Generate a password with:\n" +
        "  openssl rand -base64 24\n"
    );
    process.exit(1);
  }
  return { email: email.toLowerCase(), password };
}

async function main() {
  const { email: adminEmail, password: adminPassword } = adminCredentials();

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  // `emailVerified` is not optional here.
  //
  // authorize() in src/auth.ts refuses any credentials sign-in where it is null
  // (the gate arrived with email signup, in 20260720095900_email_auth_otp).
  // Seeding without it produced an admin who could not sign in *with the correct
  // password* — a fresh deployment following the README was locked out of its
  // own panel, with nothing in the UI to explain why. Confirmed by seeding a
  // clean database and running authorize()'s checks against the row.
  //
  // Setting it here is not a shortcut around the gate: this account is created
  // from the server's own environment by whoever already controls the machine.
  // There is no address to prove ownership of that they do not already own.
  await db.user.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail, name: "Admin", passwordHash, role: "ADMIN", emailVerified: new Date() },
    // Deliberately empty: re-seeding must never silently reset an existing
    // admin's password or role.
    update: {},
  });
  // Repairs an account seeded before the line above existed, so a deployment
  // already locked out by this is fixed by re-running the seed. Scoped to rows
  // where it is actually null, so a real verification date is never overwritten.
  const repaired = await db.user.updateMany({
    where: { email: adminEmail, emailVerified: null },
    data: { emailVerified: new Date() },
  });
  if (repaired.count > 0) {
    console.log("Marked the existing admin's email as verified — it could not have signed in otherwise.");
  }
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
