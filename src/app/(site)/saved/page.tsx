import type { Metadata } from "next";
import { PageHeader, Section } from "@/components/site/section";
import { LibraryPage } from "@/components/site/library-views";

export const metadata: Metadata = {
  title: "Saved courses",
  description: "Courses you saved and recently viewed on this device.",
  // Personal to each browser and empty for a crawler: nothing to index.
  robots: { index: false, follow: true },
  alternates: { canonical: "/saved" },
};

export default function SavedPage() {
  return (
    <Section className="py-12">
      <PageHeader
        eyebrow="Your library"
        title="Saved & recently viewed"
        description="Kept in this browser only. No account, nothing sent to us."
      />
      <LibraryPage />
    </Section>
  );
}
