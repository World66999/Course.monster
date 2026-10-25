import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCourseRequestBySlug, getRequestCategories } from "@/lib/course-requests";
import { PageHeader, Section } from "@/components/site/section";
import { RequestForm } from "@/components/site/requests/request-form";

interface Props {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = {
  title: "Edit request",
  robots: { index: false, follow: false },
};

export default async function EditCourseRequestPage({ params }: Props) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/requests/${slug}/edit`);

  const [request, categories] = await Promise.all([getCourseRequestBySlug(slug), getRequestCategories()]);
  if (!request || request.moderationStatus === "DELETED") notFound();
  if (request.userId !== session.user.id) redirect(`/requests/${slug}`);

  return (
    <Section className="max-w-3xl py-12">
      <PageHeader eyebrow="Community" title="Edit request" />
      <RequestForm
        categories={categories}
        existing={{
          id: request.id,
          kind: request.kind,
          title: request.title,
          categoryId: request.categoryId,
          subject: request.subject,
          description: request.description,
          motivation: request.motivation,
          skillLevel: request.skillLevel,
          instructor: request.instructor,
          sourceProvider: request.sourceProvider,
          referenceUrl: request.referenceUrl,
          tags: request.tags,
          imageUrl: request.imageUrl,
          anonymous: request.anonymous,
        }}
      />
    </Section>
  );
}
