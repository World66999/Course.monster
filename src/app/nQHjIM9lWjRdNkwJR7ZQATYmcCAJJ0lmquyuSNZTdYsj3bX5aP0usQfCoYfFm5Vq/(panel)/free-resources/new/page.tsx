import type { Metadata } from "next";
import { FreeResourceForm } from "@/components/admin/free-resource-form";

export const metadata: Metadata = { title: "New resource" };
export const dynamic = "force-dynamic";

export default function NewFreeResourcePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">New resource</h1>
      <FreeResourceForm
        resourceId={null}
        defaultValues={{
          title: "",
          description: "",
          url: "",
          category: "OTHER",
          thumbnail: "",
          tags: "",
          featured: false,
          published: false,
          order: 0,
        }}
      />
    </div>
  );
}
