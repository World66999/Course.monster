import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { FreeResourcesTable, type AdminFreeResourceRow } from "@/components/admin/free-resources-table";

export const metadata: Metadata = { title: "Free Resources" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/**
 * Authorization note: this page is inside the (panel) layout, which calls
 * requireAdmin() — and middleware gates the whole admin segment before that.
 * Every mutation the table invokes re-checks requireAdmin() server-side too,
 * so reaching this UI is never what authorizes a write.
 */
export default async function AdminFreeResourcesPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const q = first(raw.q);
  const status = first(raw.status);
  const page = Math.max(1, Number(first(raw.page)) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where: Prisma.FreeResourceWhereInput = {
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { url: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(status === "published" ? { published: true } : {}),
    ...(status === "draft" ? { published: false } : {}),
  };

  const [total, resources] = await Promise.all([
    db.freeResource.count({ where }),
    db.freeResource.findMany({
      where,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }, { id: "asc" }],
      skip,
      take: PAGE_SIZE,
    }),
  ]);

  const rows: AdminFreeResourceRow[] = resources.map((r) => ({
    id: r.id,
    title: r.title,
    url: r.url,
    sourceType: r.sourceType,
    category: r.category,
    published: r.published,
    featured: r.featured,
    order: r.order,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading">Free Resources</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Curate outbound links to free material. Link-out only — nothing is downloaded, mirrored or hosted
          here. The source badge is derived from each URL&apos;s hostname and cannot be set by hand.
        </p>
      </div>

      <FreeResourcesTable rows={rows} page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} />
    </div>
  );
}
