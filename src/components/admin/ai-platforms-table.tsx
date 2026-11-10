"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Eye,
  Pencil,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "@/lib/toast";
import {
  deleteAiPlatformsAction,
  setAiPlatformOrderAction,
  toggleAiPlatformFeaturedAction,
  toggleAiPlatformPublishedAction,
} from "@/server/actions/admin-ai-platforms";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminPath } from "@/lib/admin-path";
import { AI_CATEGORY_LABELS, AI_PRICING_LABELS, AI_PRICING_VARIANTS, labelFor } from "@/lib/directory-labels";
import { safeAction } from "@/lib/safe-action";
import { useAdminParams, useDebouncedParam } from "@/components/admin/use-admin-params";
import { cn } from "@/lib/utils";

export interface AdminAiPlatformRow {
  id: string;
  name: string;
  url: string;
  category: string;
  pricingType: string;
  published: boolean;
  featured: boolean;
  order: number;
}

export function AiPlatformsTable({
  rows,
  page,
  pageCount,
}: {
  rows: AdminAiPlatformRow[];
  page: number;
  pageCount: number;
}) {
  const router = useRouter();
  const { searchParams, update, goToPage, isPending } = useAdminParams();
  const [q, setQ] = useDebouncedParam("q", update, searchParams);
  const [localRows, setLocalRows] = React.useState(rows);

  React.useEffect(() => setLocalRows(rows), [rows]);

  async function onTogglePublished(id: string) {
    const result = await safeAction(() => toggleAiPlatformPublishedAction(id));
    if (!result.ok) return toast.error(result.error);
    setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, published: !r.published } : r)));
  }

  async function onToggleFeatured(id: string) {
    const result = await safeAction(() => toggleAiPlatformFeaturedAction(id));
    if (!result.ok) return toast.error(result.error);
    setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, featured: !r.featured } : r)));
  }

  async function onMove(id: string, direction: -1 | 1) {
    const row = localRows.find((r) => r.id === id);
    if (!row) return;
    const nextOrder = Math.max(0, row.order + direction);
    const result = await safeAction(() => setAiPlatformOrderAction({ id, order: nextOrder }));
    if (!result.ok) return toast.error(result.error);
    setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, order: nextOrder } : r)));
    router.refresh();
  }

  async function onDelete(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return;
    const result = await safeAction(() => deleteAiPlatformsAction([id]));
    if (!result.ok) return toast.error(result.error);
    toast.success("Platform deleted");
    setLocalRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-64">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search platforms…" className="pl-9" />
        </div>
        <Link href={adminPath("ai-platforms/new")} className={buttonClasses("primary", "sm")}>
          New AI platform
        </Link>
      </div>

      {/* Dimmed and inert while the next page/filter is in flight, so a slow
          query cannot leave stale rows looking current and clickable. */}
      <div
        aria-busy={isPending}
        className={cn(
          "relative overflow-x-auto rounded-card border border-border bg-card shadow-soft",
          "transition-opacity duration-200",
          isPending && "pointer-events-none opacity-60"
        )}
      >
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs tracking-wider text-muted-foreground uppercase">
              <th className="p-3 font-medium">Platform</th>
              <th className="p-3 font-medium">Category</th>
              <th className="p-3 font-medium">Free access</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Order</th>
              <th className="w-64 p-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {localRows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-muted-foreground">
                  No platforms match your filters.
                </td>
              </tr>
            )}
            {localRows.map((row) => (
              <tr key={row.id} className="border-b border-border transition-colors duration-150 last:border-0 hover:bg-primary-soft/45">
                <td className="max-w-72 p-3">
                  <span className="block truncate font-medium">{row.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{row.url}</span>
                </td>
                <td className="p-3">
                  <Badge variant="outline">{labelFor(AI_CATEGORY_LABELS, row.category)}</Badge>
                </td>
                <td className="p-3">
                  <Badge variant={AI_PRICING_VARIANTS[row.pricingType] ?? "secondary"}>
                    {labelFor(AI_PRICING_LABELS, row.pricingType)}
                  </Badge>
                </td>
                <td className="p-3">
                  <Badge variant={row.published ? "success" : "secondary"}>
                    {row.published ? "Published" : "Draft"}
                  </Badge>
                  {row.featured && (
                    <Badge variant="warning" className="ml-1">
                      Featured
                    </Badge>
                  )}
                </td>
                <td className="p-3 tabular-nums">{row.order}</td>
                <td className="p-3">
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button variant="ghost" size="icon" aria-label="Move up" onClick={() => void onMove(row.id, -1)}>
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Move down" onClick={() => void onMove(row.id, 1)}>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonClasses("ghost", "icon")}
                      aria-label="Preview official site in a new tab"
                    >
                      <Eye className="h-4 w-4" />
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={row.published ? "Unpublish" : "Publish"}
                      onClick={() => void onTogglePublished(row.id)}
                    >
                      <ExternalLink className={row.published ? "h-4 w-4 text-success" : "h-4 w-4"} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={row.featured ? "Unfeature" : "Feature"}
                      onClick={() => void onToggleFeatured(row.id)}
                      className={row.featured ? "text-primary" : undefined}
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                    <Link
                      href={adminPath(`ai-platforms/${row.id}/edit`)}
                      className={buttonClasses("ghost", "icon")}
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => void onDelete(row.id, row.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)} className={buttonClasses("outline", "sm")}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <button type="button" disabled={page >= pageCount} onClick={() => goToPage(page + 1)} className={buttonClasses("outline", "sm")}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
