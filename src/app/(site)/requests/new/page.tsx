import type { Metadata } from "next";
import { getRequestCategories } from "@/lib/course-requests";
import { Section } from "@/components/site/section";
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Request a course</h1>
        <p className="mt-2 text-muted-foreground">
          Tell the community what you&apos;re looking for, or share a resource you recommend.
        </p>
      </div>
      <SignInGate prompt="Sign in to request a course.">
        <RequestForm categories={categories} />
      </SignInGate>
    </Section>
  );
}
