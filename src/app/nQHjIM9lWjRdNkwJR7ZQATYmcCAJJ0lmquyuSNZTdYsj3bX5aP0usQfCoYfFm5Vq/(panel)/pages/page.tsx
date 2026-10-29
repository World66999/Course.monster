import type { Metadata } from "next";
import { db } from "@/lib/db";
import { STANDALONE_PAGES } from "@/lib/pages";
import { PageEditor } from "@/components/admin/page-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata: Metadata = { title: "Pages" };
export const dynamic = "force-dynamic";

export default async function AdminPagesPage() {
  const rows = await db.page.findMany({
    where: { slug: { in: STANDALONE_PAGES.map((p) => p.slug) } },
  });
  const bySlug = new Map(rows.map((p) => [p.slug, p]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading">Pages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit the download guide. The legal pages (Terms, Privacy, Refund Policy, Copyright,
          Contact) are maintained in code so they always match the checkout and show only the
          Telegram support contact.
        </p>
      </div>
      <Tabs defaultValue={STANDALONE_PAGES[0].slug}>
        <TabsList>
          {STANDALONE_PAGES.map((meta) => (
            <TabsTrigger key={meta.slug} value={meta.slug}>
              {meta.title}
            </TabsTrigger>
          ))}
        </TabsList>
        {STANDALONE_PAGES.map((meta) => {
          const page = bySlug.get(meta.slug);
          return (
            <TabsContent key={meta.slug} value={meta.slug}>
              <PageEditor
                slug={meta.slug}
                publicPath={meta.path}
                defaultTitle={page?.title ?? meta.title}
                defaultContent={page?.content ?? ""}
              />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
