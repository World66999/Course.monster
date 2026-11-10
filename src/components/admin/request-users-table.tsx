"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2, RotateCcw, Search, ShieldOff } from "lucide-react";
import { toast } from "@/lib/toast";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button, buttonClasses } from "@/components/ui/button";
import { banUserFromRequestsAction, unbanUserFromRequestsAction } from "@/server/actions/admin-course-requests";
import { safeAction } from "@/lib/safe-action";
import { useAdminParams, useDebouncedParam } from "@/components/admin/use-admin-params";
import { cn } from "@/lib/utils";

export interface RequestUserRow {
  id: string;
  name: string;
  role: "ADMIN" | "EDITOR" | "USER";
  requestBanned: boolean;
  createdAt: string;
}

function RowActions({ row, onBan, onUnban }: { row: RequestUserRow; onBan: (id: string) => Promise<void>; onUnban: (id: string) => Promise<void> }) {
  const [busy, setBusy] = React.useState(false);
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }
  if (row.role !== "USER") return <span className="text-xs text-muted-foreground">Staff</span>;
  return row.requestBanned ? (
    <Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => onUnban(row.id))}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
      Unban
    </Button>
  ) : (
    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" disabled={busy} onClick={() => run(() => onBan(row.id))}>
      <ShieldOff className="h-3.5 w-3.5" />
      Ban
    </Button>
  );
}

export function RequestUsersTable({ rows, page, pageCount }: { rows: RequestUserRow[]; page: number; pageCount: number }) {
  const { searchParams, update, goToPage, isPending } = useAdminParams();
  const [q, setQ] = useDebouncedParam("uq", update, searchParams);
  const [localRows, setLocalRows] = React.useState(rows);
  const [, startTransition] = React.useTransition();
  const [optimisticRows, applyOptimistic] = React.useOptimistic(
    localRows,
    (state: RequestUserRow[], action: { type: "ban" | "unban"; id: string }) =>
      state.map((r) => (r.id === action.id ? { ...r, requestBanned: action.type === "ban" } : r))
  );

  React.useEffect(() => setLocalRows(rows), [rows]);

  async function onBan(id: string) {
    startTransition(() => applyOptimistic({ type: "ban", id }));
    const result = await safeAction(() => banUserFromRequestsAction(id));
    if (!result.ok) {
      toast.error(result.error ?? "Something went wrong");
      return;
    }
    toast.success("Banned");
    setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, requestBanned: true } : r)));
  }

  async function onUnban(id: string) {
    startTransition(() => applyOptimistic({ type: "unban", id }));
    const result = await safeAction(() => unbanUserFromRequestsAction(id));
    if (!result.ok) {
      toast.error(result.error ?? "Something went wrong");
      return;
    }
    toast.success("Unbanned");
    setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, requestBanned: false } : r)));
  }

  return (
    <div className="space-y-4">
      <div className="relative w-64">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users…" className="pl-9" />
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
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs tracking-wider text-muted-foreground uppercase">
              <th className="p-3 font-medium">User</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Joined</th>
              <th className="w-40 p-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {optimisticRows.length === 0 && (
              <tr>
                <td colSpan={4} className="p-10 text-center text-muted-foreground">
                  No users match your search.
                </td>
              </tr>
            )}
            {optimisticRows.map((row) => (
              <tr key={row.id} className="border-b border-border transition-colors duration-150 last:border-0 hover:bg-primary-soft/45">
                <td className="p-3 font-medium">{row.name}</td>
                <td className="p-3">
                  {row.requestBanned ? (
                    <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
                      Banned
                    </Badge>
                  ) : (
                    <Badge variant="success">Active</Badge>
                  )}
                </td>
                <td className="p-3 whitespace-nowrap text-muted-foreground">
                  <span suppressHydrationWarning>{formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}</span>
                </td>
                <td className="p-3">
                  <RowActions row={row} onBan={onBan} onUnban={onUnban} />
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
