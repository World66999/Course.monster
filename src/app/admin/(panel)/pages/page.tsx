import type { Metadata } from "next";
import { db } from "@/lib/db";
import { PageEditor } from "@/components/admin/page-editor";

export const metadata: Metadata = { title: "Pages" };
export const dynamic = "force-dynamic";

export default async function AdminPagesPage() {
  const page = await db.page.findUnique({ where: { slug: "how-to-download" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit the content of your site&apos;s standalone pages.
        </p>
      </div>
      <PageEditor
        slug="how-to-download"
        publicPath="/how-to-download"
        defaultTitle={page?.title ?? "How to Download"}
        defaultContent={page?.content ?? ""}
      />
    </div>
  );
}
