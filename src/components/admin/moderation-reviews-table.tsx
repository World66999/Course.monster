"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Search, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModerationActions } from "@/components/admin/moderation-actions";
import { buttonClasses } from "@/components/ui/button";

export interface ModerationReviewRow {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  status: "VISIBLE" | "HIDDEN" | "DELETED";
  createdAt: string;
  author: { name: string; email: string };
  course: { title: string; slug: string } | null;
}

const STATUS_BADGE = {
  VISIBLE: { label: "Visible", variant: "success" as const },
  HIDDEN: { label: "Hidden", variant: "warning" as const },
  DELETED: { label: "Deleted", variant: "secondary" as const },
};

const ALL = "__all__";

export function ModerationReviewsTable({
  rows,
  page,
  pageCount,
}: {
  rows: ModerationReviewRow[];
  page: number;
  pageCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = React.useState(searchParams.get("q") ?? "");

  function update(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  React.useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => update({ q }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function goToPage(next: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (next > 1) params.set("page", String(next));
    else params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  const currentStatus = searchParams.get("status") ?? "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reviews…" className="pl-9" />
        </div>
        <div className="w-44">
          <Select value={currentStatus || ALL} onValueChange={(v) => update({ status: v === ALL ? "" : v })}>
            <SelectTrigger aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="VISIBLE">Visible</SelectItem>
              <SelectItem value="HIDDEN">Hidden</SelectItem>
              <SelectItem value="DELETED">Deleted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="relative overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs tracking-wider text-muted-foreground uppercase">
              <th className="p-3 font-medium">Review</th>
              <th className="p-3 font-medium">Rating</th>
              <th className="p-3 font-medium">Author</th>
              <th className="p-3 font-medium">Course</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Posted</th>
              <th className="w-32 p-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-10 text-center text-muted-foreground">
                  No reviews match your filters.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="max-w-72 p-3">
                  {row.title && <p className="truncate font-medium">{row.title}</p>}
                  <p className="truncate text-muted-foreground">{row.body}</p>
                </td>
                <td className="p-3">
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-warning text-warning" aria-hidden />
                    {row.rating}
                  </span>
                </td>
                <td className="p-3">
                  <p className="font-medium">{row.author.name}</p>
                </td>
                <td className="p-3">
                  {row.course ? (
                    <Link href={`/courses/${row.course.slug}`} target="_blank" className="hover:text-primary hover:underline">
                      {row.course.title}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-3">
                  <Badge variant={STATUS_BADGE[row.status].variant}>{STATUS_BADGE[row.status].label}</Badge>
                </td>
                <td className="p-3 whitespace-nowrap text-muted-foreground">
                  <span suppressHydrationWarning>{formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}</span>
                </td>
                <td className="p-3">
                  <ModerationActions kind="review" id={row.id} status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
            className={buttonClasses("outline", "sm")}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => goToPage(page + 1)}
            className={buttonClasses("outline", "sm")}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
