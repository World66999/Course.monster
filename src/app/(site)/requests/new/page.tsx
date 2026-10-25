import type { Metadata } from "next";
import { getRequestCategories } from "@/lib/course-requests";
import { PageHeader, Section } from "@/components/site/section";
import { SignInGate } from "@/components/site/sign-in-gate";
import { RequestForm } from "@/components/site/requests/request-form";

export const metadata: Metadata = {
  title: "Request a course",
  robots: { index: false, follow: false },
};

export default async function NewCourseRequestPage() {
  const categories = await getRequestCategories();

  return (
    <Section className="max-w-3xl py-12">
      <PageHeader
        eyebrow="Community"
        title="Request a course"
        description="Tell the community what you're looking for, or share a resource you recommend."
      />
      <SignInGate prompt="Sign in to request a course.">
        <RequestForm categories={categories} />
      </SignInGate>
    </Section>
  );
}
