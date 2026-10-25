import type { Metadata } from "next";
import { Crown } from "lucide-react";
import { listPremiumResourcesPublic } from "@/lib/premium-catalog";
import { absoluteUrl } from "@/lib/utils";
import { PageHeader, Section } from "@/components/site/section";
import { PremiumResourceGrid } from "@/components/premium/resource-grid";

export const metadata: Metadata = {
  title: "Premium Resources — Coding Help, AI Tools, GitHub Projects & More",
  description:
    "Hand-written Premium guides: coding help and solutions, legitimate ways to access AI tools and prompt them well, curated GitHub projects, learning roadmaps and free alternatives to paid apps.",
  alternates: { canonical: "/premium-resources" },
  openGraph: { title: "Premium Resources — Courses Monster", url: absoluteUrl("/premium-resources") },
};

/**
 * Cached and identical for every visitor: only titles, summaries and
 * categories are in this page. The locked body of each item is fetched by the
 * client from /api/premium/resources/<id>, which checks Premium first.
 */
export const revalidate = 300;

export default async function PremiumResourcesPage() {
  const categories = await listPremiumResourcesPublic();
  return (
    <Section className="py-12">
      <PageHeader
        eyebrow="Premium"
        title={
          <span className="inline-flex items-center gap-3">
            Premium Resources <Crown className="h-8 w-8 text-gold" aria-hidden />
          </span>
        }
        description="Practical, hand-written guides from our team — browse every title for free, and unlock the full content with Premium."
      />
      <PremiumResourceGrid categories={categories} />
    </Section>
  );
}
