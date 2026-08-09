"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReportActions } from "@/components/admin/moderation-actions";
import { buttonClasses } from "@/components/ui/button";

export interface ModerationReportRow {
  id: string;
  reason: string;
  note: string | null;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  createdAt: string;
  reporter: { name: string };
  targetKind:
    | "comment"
    | "review"
    | "chat"
    | "courseRequest"
    | "requestComment"
    | "codingChannel"
    | "learningResource"
    | "appListing";
  targetPreview: string;
}

const STATUS_BADGE = {
  OPEN: { label: "Open", variant: "warning" as const },
  RESOLVED: { label: "Resolved", variant: "success" as const },
  DISMISSED: { label: "Dismissed", variant: "secondary" as const },
};

const ALL = "__all__";

export function ModerationReportsTable({
  rows,
  page,
  pageCount,
}: {
  rows: ModerationReportRow[];
  page: number;
  pageCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function goToPage(next: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (next > 1) params.set("page", String(next));
    else params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  const currentStatus = searchParams.get("reportStatus") ?? "OPEN";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="w-48">
          <Select value={currentStatus} onValueChange={(v) => update({ reportStatus: v === ALL ? "" : v })}>
            <SelectTrigger aria-label="Filter by report status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
              <SelectItem value="DISMISSED">Dismissed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="relative overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs tracking-wider text-muted-foreground uppercase">
              <th className="p-3 font-medium">Reported content</th>
              <th className="p-3 font-medium">Reason</th>
              <th className="p-3 font-medium">Reported by</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">When</th>
              <th className="w-44 p-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-muted-foreground">
                  No reports match your filters.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="max-w-80 p-3">
                  <Badge variant="outline" className="mb-1">
                    {row.targetKind}
                  </Badge>
                  <p className="truncate text-muted-foreground">{row.targetPreview}</p>
                  {row.note && <p className="mt-1 truncate text-xs italic text-muted-foreground">“{row.note}”</p>}
                </td>
                <td className="p-3">{row.reason}</td>
                <td className="p-3">{row.reporter.name}</td>
                <td className="p-3">
                  <Badge variant={STATUS_BADGE[row.status].variant}>{STATUS_BADGE[row.status].label}</Badge>
                </td>
                <td className="p-3 whitespace-nowrap text-muted-foreground" suppressHydrationWarning>
                  {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
                </td>
                <td className="p-3">{row.status === "OPEN" && <ReportActions id={row.id} />}</td>
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
