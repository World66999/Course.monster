import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { AiPlatformForm } from "@/components/admin/ai-platform-form";

export const metadata: Metadata = { title: "Edit AI platform" };
export const dynamic = "force-dynamic";

export default async function EditAiPlatformPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const platform = await db.aiPlatform.findUnique({ where: { id } });
  if (!platform) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Edit AI platform</h1>
      <AiPlatformForm
        platformId={platform.id}
        defaultValues={{
          name: platform.name,
          description: platform.description ?? "",
          url: platform.url,
          category: platform.category,
          pricingType: platform.pricingType,
          freeTierNote: platform.freeTierNote ?? "",
          logo: platform.logo ?? "",
          tags: platform.tags.join(", "),
          featured: platform.featured,
          published: platform.published,
          order: platform.order,
        }}
      />
    </div>
  );
}
