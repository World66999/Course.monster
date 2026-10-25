"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, ChevronLeft, ChevronRight, ExternalLink, Pencil, Search, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteChannelsAction,
  toggleChannelPublishedAction,
  toggleChannelFeaturedAction,
  toggleChannelVerifiedAction,
} from "@/server/actions/admin-coding-channels";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminPath } from "@/lib/admin-path";
import { safeAction } from "@/lib/safe-action";
import { useAdminParams, useDebouncedParam } from "@/components/admin/use-admin-params";
import { cn } from "@/lib/utils";

export interface AdminChannelRow {
  id: string;
  name: string;
  slug: string;
  url: string;
  logo: string | null;
  published: boolean;
  featured: boolean;
  verified: boolean;
  bookmarkCount: number;
  views: number;
  createdAt: string;
}

export function CodingChannelsTable({ rows, page, pageCount }: { rows: AdminChannelRow[]; page: number; pageCount: number }) {
  const { searchParams, update, goToPage, isPending } = useAdminParams();
  const [q, setQ] = useDebouncedParam("q", update, searchParams);
  const [localRows, setLocalRows] = React.useState(rows);

  React.useEffect(() => setLocalRows(rows), [rows]);

  async function onTogglePublished(id: string) {
    const result = await safeAction(() => toggleChannelPublishedAction(id));
    if (!result.ok) return toast.error(result.error);
    setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, published: !r.published } : r)));
  }

  async function onToggleFeatured(id: string) {
    const result = await safeAction(() => toggleChannelFeaturedAction(id));
    if (!result.ok) return toast.error(result.error);
    setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, featured: !r.featured } : r)));
  }

  async function onToggleVerified(id: string) {
    const result = await safeAction(() => toggleChannelVerifiedAction(id));
    if (!result.ok) return toast.error(result.error);
    setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, verified: !r.verified } : r)));
  }

  async function onDelete(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return;
    const result = await safeAction(() => deleteChannelsAction([id]));
    if (!result.ok) return toast.error(result.error);
    toast.success("Channel deleted");
    setLocalRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-64">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search channels…" className="pl-9" />
        </div>
        <Link href={adminPath("coding-channels/new")} className={buttonClasses("primary", "sm")}>
          New channel
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
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs tracking-wider text-muted-foreground uppercase">
              <th className="p-3 font-medium">Channel</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Bookmarks</th>
              <th className="p-3 font-medium">Views</th>
              <th className="w-64 p-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {localRows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-muted-foreground">
                  No channels match your filters.
                </td>
              </tr>
            )}
            {localRows.map((row) => (
              <tr key={row.id} className="border-b border-border transition-colors duration-150 last:border-0 hover:bg-primary-soft/45">
                <td className="max-w-72 p-3">
                  <div className="flex items-center gap-2">
                    {row.logo && (
                      <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                        <Image src={row.logo} alt="" fill sizes="32px" className="object-cover" unoptimized />
                      </span>
                    )}
                    <span className="truncate font-medium">{row.name}</span>
                    {row.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />}
                  </div>
                </td>
                <td className="p-3">
                  <Badge variant={row.published ? "success" : "secondary"}>{row.published ? "Published" : "Draft"}</Badge>
                  {row.featured && <Badge variant="warning" className="ml-1">Featured</Badge>}
                </td>
                <td className="p-3 tabular-nums">{row.bookmarkCount}</td>
                <td className="p-3 tabular-nums">{row.views}</td>
                <td className="p-3">
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button variant="ghost" size="icon" aria-label={row.published ? "Unpublish" : "Publish"} onClick={() => void onTogglePublished(row.id)}>
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
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={row.verified ? "Unverify" : "Verify"}
                      onClick={() => void onToggleVerified(row.id)}
                      className={row.verified ? "text-primary" : undefined}
                    >
                      <BadgeCheck className="h-4 w-4" />
                    </Button>
                    <Link href={adminPath(`coding-channels/${row.id}/edit`)} className={buttonClasses("ghost", "icon")} aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <Button variant="ghost" size="icon" aria-label="Delete" className="text-destructive hover:bg-destructive/10" onClick={() => void onDelete(row.id, row.name)}>
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
          <span className="text-sm text-muted-foreground">Page {page} of {pageCount}</span>
          <button type="button" disabled={page >= pageCount} onClick={() => goToPage(page + 1)} className={buttonClasses("outline", "sm")}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
