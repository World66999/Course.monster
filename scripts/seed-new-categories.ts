import { PrismaClient } from "@prisma/client";
import { slugify } from "../src/lib/utils";

const db = new PrismaClient();

/**
 * One-time expansion of the category catalog. Each entry's slug is derived
 * with the same `slugify()` the admin UI uses, so any entry here that
 * happens to match an existing category's slug (e.g. "Web Development",
 * "Data Science") is reused via upsert instead of duplicated. A few entries
 * (C / C++ / C#) collide under auto-slugify and get an explicit slug.
 */
const NEW_CATEGORIES: { name: string; slug?: string }[] = [
  // Core Computer Science
  { name: "Data Structures & Algorithms (DSA)" },
  { name: "Competitive Programming" },
  { name: "Programming Languages" },
  { name: "Object-Oriented Programming" },
  { name: "System Design" },
  { name: "Operating Systems" },
  { name: "Computer Networks" },
  { name: "Database Management Systems (DBMS)" },
  { name: "Compiler Design" },
  { name: "Software Engineering" },

  // Development
  { name: "Web Development" },
  { name: "Frontend Development" },
  { name: "Backend Development" },
  { name: "Full Stack Development" },
  { name: "Mobile App Development" },
  { name: "Desktop Development" },
  { name: "Game Development" },
  { name: "API Development" },

  // Cloud & Infrastructure
  { name: "DevOps" },
  { name: "Cloud Computing" },
  { name: "AWS" },
  { name: "Microsoft Azure" },
  { name: "Google Cloud (GCP)" },
  { name: "Kubernetes" },
  { name: "Docker" },
  { name: "Linux" },
  { name: "Networking" },
  { name: "Virtualization" },

  // Cyber Security
  { name: "Ethical Hacking" },
  { name: "Penetration Testing" },
  { name: "Digital Forensics" },
  { name: "Network Security" },
  { name: "Web Security" },
  { name: "Bug Bounty" },
  { name: "Cyber Security" },

  // Artificial Intelligence
  { name: "Artificial Intelligence" },
  { name: "Machine Learning" },
  { name: "Deep Learning" },
  { name: "Data Science" },
  { name: "Generative AI" },
  { name: "Large Language Models (LLMs)" },
  { name: "Computer Vision" },
  { name: "NLP" },
  { name: "MLOps" },

  // Blockchain
  { name: "Blockchain" },
  { name: "Web3" },
  { name: "Smart Contracts" },
  { name: "Solidity" },
  { name: "Ethereum" },
  { name: "Cryptocurrency" },

  // Programming
  { name: "Python" },
  { name: "Java" },
  { name: "JavaScript" },
  { name: "TypeScript" },
  { name: "C", slug: "c" },
  { name: "C++", slug: "cpp" },
  { name: "C#", slug: "csharp" },
  { name: "Go" },
  { name: "Rust" },
  { name: "Kotlin" },
  { name: "Swift" },
  { name: "PHP" },
  { name: "Ruby" },

  // Engineering Exams
  { name: "GATE" },
  { name: "UGC NET" },
  { name: "ISRO" },
  { name: "DRDO" },
  { name: "PSU Preparation" },

  // Networking & Certifications
  { name: "CCNA" },
  { name: "CCNP" },
  { name: "RHCSA" },
  { name: "RHCE" },
  { name: "AWS Certification" },
  { name: "Azure Certification" },
  { name: "Google Cloud Certification" },

  // Data
  { name: "SQL" },
  { name: "NoSQL" },
  { name: "Big Data" },
  { name: "Apache Spark" },
  { name: "Hadoop" },

  // Business
  { name: "Digital Marketing" },
  { name: "UI/UX Design" },
  { name: "Graphic Design" },
  { name: "Product Management" },
  { name: "Project Management" },
  { name: "Entrepreneurship" },
  { name: "Finance" },
  { name: "Stock Market" },

  // Productivity
  { name: "Excel" },
  { name: "Power BI" },
  { name: "Tableau" },
  { name: "Microsoft Office" },
];

async function main() {
  const seen = new Set<string>();
  const entries = NEW_CATEGORIES.map((c) => {
    const slug = c.slug ?? slugify(c.name);
    if (seen.has(slug)) {
      throw new Error(`Duplicate slug "${slug}" produced for "${c.name}" — add an explicit slug override.`);
    }
    seen.add(slug);
    return { name: c.name, slug };
  });

  const last = await db.category.findFirst({
    orderBy: { order: "desc" },
    select: { order: true },
  });
  let nextOrder = (last?.order ?? 0) + 1;

  let created = 0;
  let reused = 0;
  for (const entry of entries) {
    const existing = await db.category.findUnique({ where: { slug: entry.slug } });
    if (existing) {
      reused++;
      continue;
    }
    await db.category.create({
      data: { name: entry.name, slug: entry.slug, order: nextOrder },
    });
    nextOrder++;
    created++;
  }

  console.log(`Categories: ${created} created, ${reused} already existed (reused, untouched).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
