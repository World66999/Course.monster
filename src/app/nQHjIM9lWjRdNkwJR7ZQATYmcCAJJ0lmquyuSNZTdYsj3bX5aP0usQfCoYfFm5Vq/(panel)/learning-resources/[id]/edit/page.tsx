import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { LearningResourceForm } from "@/components/admin/learning-resource-form";

export const metadata: Metadata = { title: "Edit learning resource" };
export const dynamic = "force-dynamic";

export default async function EditLearningResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [resource, categories] = await Promise.all([
    db.learningResource.findUnique({ where: { id } }),
    db.category.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!resource) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-heading">Edit learning resource</h1>
      <LearningResourceForm
        resourceId={resource.id}
        categories={categories}
        defaultValues={{
          title: resource.title,
          slug: resource.slug,
          url: resource.url,
          resourceType: resource.resourceType,
          description: resource.description ?? "",
          thumbnail: resource.thumbnail ?? "",
          creatorName: resource.creatorName ?? "",
          categoryId: resource.categoryId ?? "",
          tags: resource.tags.join(", "),
          skillLevel: resource.skillLevel ?? "",
          spokenLanguage: resource.spokenLanguage ?? "",
          durationMinutes: resource.durationMinutes ?? undefined,
          featured: resource.featured,
          published: resource.published,
        }}
      />
    </div>
  );
}
