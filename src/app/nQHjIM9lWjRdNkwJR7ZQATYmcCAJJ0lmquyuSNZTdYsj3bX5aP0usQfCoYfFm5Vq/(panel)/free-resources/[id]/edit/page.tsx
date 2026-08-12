import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { FreeResourceForm } from "@/components/admin/free-resource-form";

export const metadata: Metadata = { title: "Edit resource" };
export const dynamic = "force-dynamic";

export default async function EditFreeResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resource = await db.freeResource.findUnique({ where: { id } });
  if (!resource) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Edit resource</h1>
      <FreeResourceForm
        resourceId={resource.id}
        defaultValues={{
          title: resource.title,
          description: resource.description ?? "",
          url: resource.url,
          category: resource.category,
          thumbnail: resource.thumbnail ?? "",
          tags: resource.tags.join(", "),
          featured: resource.featured,
          published: resource.published,
          order: resource.order,
        }}
      />
    </div>
  );
}
