import type { Metadata } from "next";
import { db } from "@/lib/db";
import { LearningResourceForm } from "@/components/admin/learning-resource-form";

export const metadata: Metadata = { title: "New learning resource" };
export const dynamic = "force-dynamic";

export default async function NewLearningResourcePage() {
  const categories = await db.category.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">New learning resource</h1>
      <LearningResourceForm
        resourceId={null}
        categories={categories}
        defaultValues={{
          title: "",
          slug: "",
          url: "",
          resourceType: "VIDEO",
          description: "",
          thumbnail: "",
          creatorName: "",
          categoryId: "",
          tags: "",
          skillLevel: "",
          spokenLanguage: "",
          durationMinutes: undefined,
          featured: false,
          published: false,
        }}
      />
    </div>
  );
}
