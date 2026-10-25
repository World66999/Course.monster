"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Search } from "lucide-react";
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
import { useAdminParams, useDebouncedParam } from "@/components/admin/use-admin-params";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface ModerationCommentRow {
  id: string;
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

export function ModerationCommentsTable({
  rows,
  page,
  pageCount,
}: {
  rows: ModerationCommentRow[];
  page: number;
  pageCount: number;
}) {
  const { searchParams, update, goToPage, isPending } = useAdminParams();
  const [q, setQ] = useDebouncedParam("q", update, searchParams);

  const currentStatus = searchParams.get("status") ?? "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search comments…" className="pl-9" />
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
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs tracking-wider text-muted-foreground uppercase">
              <th className="p-3 font-medium">Comment</th>
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
                <td colSpan={6} className="p-10 text-center text-muted-foreground">
                  No comments match your filters.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border transition-colors duration-150 last:border-0 hover:bg-primary-soft/45">
                <td className="max-w-80 truncate p-3">{row.body}</td>
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
                  <ModerationActions kind="comment" id={row.id} status={row.status} />
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
