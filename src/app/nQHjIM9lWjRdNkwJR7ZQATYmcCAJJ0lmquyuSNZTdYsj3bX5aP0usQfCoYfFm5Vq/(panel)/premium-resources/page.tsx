import type { Metadata } from "next";
import { db } from "@/lib/db";
import { PremiumResourcesManager } from "@/components/admin/premium/premium-resources-manager";

export const metadata: Metadata = { title: "Premium Resources" };
export const dynamic = "force-dynamic";

export default async function AdminPremiumResourcesPage() {
  const [categories, resources] = await Promise.all([
    db.premiumCategory.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, description: true, icon: true, order: true, _count: { select: { resources: true } } },
    }),
    db.premiumResource.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      select: { id: true, categoryId: true, title: true, summary: true, content: true, url: true, tags: true, published: true, order: true },
    }),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading">Premium Resources</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Title and summary are public; content and link are only served to Premium members through the API.
        </p>
      </div>
      <PremiumResourcesManager
        categories={categories.map(({ _count, ...c }) => ({ ...c, count: _count.resources }))}
        resources={resources}
      />
    </div>
  );
}
