import type { Metadata } from "next";
import { AppListingForm } from "@/components/admin/app-listing-form";

export const metadata: Metadata = { title: "New app" };
export const dynamic = "force-dynamic";

export default function NewAppPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">New app</h1>
      <AppListingForm
        appId={null}
        defaultValues={{
          name: "",
          slug: "",
          icon: "",
          screenshots: [],
          shortDescription: "",
          description: "",
          developer: "",
          projectUrl: "",
          sourceUrl: "",
          downloadUrl: "",
          platform: "ANDROID",
          category: "UTILITIES",
          version: "",
          appUpdatedAt: "",
          license: "",
          isOpenSource: false,
          minAndroidVersion: "",
          architecture: "",
          fileSizeLabel: "",
          tags: "",
          featured: false,
          published: false,
        }}
      />
    </div>
  );
}
