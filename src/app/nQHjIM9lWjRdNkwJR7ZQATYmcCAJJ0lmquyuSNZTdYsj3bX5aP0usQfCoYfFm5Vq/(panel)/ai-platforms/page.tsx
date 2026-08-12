import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AiPlatformsTable, type AdminAiPlatformRow } from "@/components/admin/ai-platforms-table";

export const metadata: Metadata = { title: "AI Platforms" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function AdminAiPlatformsPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const q = first(raw.q);
  const status = first(raw.status);
  const page = Math.max(1, Number(first(raw.page)) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where: Prisma.AiPlatformWhereInput = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { url: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(status === "published" ? { published: true } : {}),
    ...(status === "draft" ? { published: false } : {}),
  };

  const [total, platforms] = await Promise.all([
    db.aiPlatform.count({ where }),
    db.aiPlatform.findMany({
      where,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }, { id: "asc" }],
      skip,
      take: PAGE_SIZE,
    }),
  ]);

  const rows: AdminAiPlatformRow[] = platforms.map((p) => ({
    id: p.id,
    name: p.name,
    url: p.url,
    category: p.category,
    pricingType: p.pricingType,
    published: p.published,
    featured: p.featured,
    order: p.order,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Free AI Platforms</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Curate AI tools students can use free. Keep the free-access type accurate — students plan around
          it, and it is the one claim on the card that can mislead if it goes stale.
        </p>
      </div>

      <AiPlatformsTable rows={rows} page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} />
    </div>
  );
}
