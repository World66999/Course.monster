import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { AppListingForm } from "@/components/admin/app-listing-form";

export const metadata: Metadata = { title: "Edit app" };
export const dynamic = "force-dynamic";

export default async function EditAppPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = await db.appListing.findUnique({ where: { id } });
  if (!app) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Edit app</h1>
      <AppListingForm
        appId={app.id}
        defaultValues={{
          name: app.name,
          slug: app.slug,
          icon: app.icon ?? "",
          screenshots: app.screenshots,
          shortDescription: app.shortDescription ?? "",
          description: app.description ?? "",
          developer: app.developer ?? "",
          projectUrl: app.projectUrl ?? "",
          sourceUrl: app.sourceUrl ?? "",
          downloadUrl: app.downloadUrl,
          platform: app.platform,
          category: app.category,
          version: app.version ?? "",
          appUpdatedAt: app.appUpdatedAt ? app.appUpdatedAt.toISOString().slice(0, 10) : "",
          license: app.license ?? "",
          isOpenSource: app.isOpenSource,
          minAndroidVersion: app.minAndroidVersion ?? "",
          architecture: app.architecture ?? "",
          fileSizeLabel: app.fileSizeLabel ?? "",
          tags: app.tags.join(", "),
          featured: app.featured,
          published: app.published,
        }}
      />
    </div>
  );
}
