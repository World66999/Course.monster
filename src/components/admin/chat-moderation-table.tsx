"use client";

import * as React from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { ChevronLeft, ChevronRight, EyeOff, ImageIcon, Loader2, RotateCcw, Search, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button, buttonClasses } from "@/components/ui/button";
import { safeAction } from "@/lib/safe-action";
import { useAdminParams } from "@/components/admin/use-admin-params";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  moderateChatMessageAction,
  approveChatLinkAction,
  rejectChatLinkAction,
} from "@/server/actions/admin-chat";

export interface ChatMessageRow {
  id: string;
  body: string;
  imageThumbUrl: string | null;
  status: "VISIBLE" | "HIDDEN" | "DELETED";
  linkPending: boolean;
  createdAt: string;
  author: { label: string; isAdmin: boolean };
}

const STATUS_BADGE = {
  VISIBLE: { label: "Visible", variant: "success" as const },
  HIDDEN: { label: "Hidden", variant: "warning" as const },
  DELETED: { label: "Deleted", variant: "secondary" as const },
};

const ALL = "__all__";

function MessageActions({
  row,
  mode,
  onModerate,
  onApprove,
  onReject,
}: {
  row: ChatMessageRow;
  mode: "all" | "pending-links";
  onModerate: (id: string, status: "VISIBLE" | "HIDDEN" | "DELETED") => Promise<void>;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}) {
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

  if (mode === "pending-links") {
    return (
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => onReject(row.id))}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
          Reject
        </Button>
        <Button size="sm" disabled={busy} onClick={() => run(() => onApprove(row.id))}>
          <ShieldCheck className="h-4 w-4" />
          Approve
        </Button>
      </div>
    );
  }

  return (
    <div className="flex justify-end gap-1">
      {row.status !== "VISIBLE" && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Restore"
          disabled={busy}
          onClick={() => run(() => onModerate(row.id, "VISIBLE"))}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
        </Button>
      )}
      {row.status !== "HIDDEN" && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Hide"
          disabled={busy}
          onClick={() => run(() => onModerate(row.id, "HIDDEN"))}
        >
          <EyeOff className="h-4 w-4" />
        </Button>
      )}
      {row.status !== "DELETED" && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete"
          className="text-destructive hover:bg-destructive/10"
          disabled={busy}
          onClick={() => run(() => onModerate(row.id, "DELETED"))}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export function ChatModerationTable({
  rows,
  page,
  pageCount,
  mode,
}: {
  rows: ChatMessageRow[];
  page: number;
  pageCount: number;
  mode: "all" | "pending-links";
}) {
  const { searchParams, update, goToPage, isPending } = useAdminParams();
  const [q, setQ] = React.useState(searchParams.get("q") ?? "");
  const [localRows, setLocalRows] = React.useState(rows);
  const [, startTransition] = React.useTransition();
  const [optimisticRows, applyOptimistic] = React.useOptimistic(
    localRows,
    (state: ChatMessageRow[], action: { type: "setStatus"; id: string; status: ChatMessageRow["status"] } | { type: "remove"; id: string }) => {
      switch (action.type) {
        case "setStatus":
          return state.map((r) => (r.id === action.id ? { ...r, status: action.status, linkPending: false } : r));
        case "remove":
          return state.filter((r) => r.id !== action.id);
      }
    }
  );

  // Re-sync when pagination/filters/search produce a new server-fetched page.
  React.useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  // Not `useDebouncedParam`: this table has two modes and the search box only
  // applies in "all", so the push has to stay behind that guard. `update` is now
  // a stable callback from useAdminParams, which is what lets this list its real
  // dependencies instead of suppressing the lint rule.
  const currentQ = searchParams.get("q") ?? "";
  React.useEffect(() => {
    if (mode !== "all") return;
    if (q === currentQ) return;
    const t = setTimeout(() => update({ q }), 400);
    return () => clearTimeout(t);
  }, [q, mode, currentQ, update]);

  const currentStatus = searchParams.get("chatStatus") ?? "";

  async function onModerate(id: string, status: "VISIBLE" | "HIDDEN" | "DELETED") {
    startTransition(() => applyOptimistic({ type: "setStatus", id, status }));
    const result = await safeAction(() => moderateChatMessageAction(id, status));
    if (!result.ok) {
      toast.error(result.error ?? "Something went wrong");
      return;
    }
    toast.success(status === "VISIBLE" ? "Restored" : status === "HIDDEN" ? "Hidden" : "Deleted");
    setLocalRows((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, status, linkPending: false } : r));
      return currentStatus && currentStatus !== status ? next.filter((r) => r.id !== id) : next;
    });
  }

  async function onApprove(id: string) {
    startTransition(() => applyOptimistic({ type: "remove", id }));
    const result = await safeAction(() => approveChatLinkAction(id));
    if (!result.ok) {
      toast.error(result.error ?? "Something went wrong");
      return;
    }
    toast.success("Approved");
    setLocalRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function onReject(id: string) {
    startTransition(() => applyOptimistic({ type: "remove", id }));
    const result = await safeAction(() => rejectChatLinkAction(id));
    if (!result.ok) {
      toast.error(result.error ?? "Something went wrong");
      return;
    }
    toast.success("Rejected");
    setLocalRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-4">
      {mode === "all" && (
        <div className="flex flex-wrap gap-3">
          <div className="relative w-64">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search messages…" className="pl-9" />
          </div>
          <div className="w-44">
            <Select value={currentStatus || ALL} onValueChange={(v) => update({ chatStatus: v === ALL ? "" : v })}>
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
      )}

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
              <th className="p-3 font-medium">Message</th>
              <th className="p-3 font-medium">Author</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Posted</th>
              <th className="w-40 p-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {optimisticRows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-muted-foreground">
                  {mode === "pending-links" ? "No links awaiting approval." : "No messages match your filters."}
                </td>
              </tr>
            )}
            {optimisticRows.map((row) => (
              <tr key={row.id} className="border-b border-border transition-colors duration-150 last:border-0 hover:bg-primary-soft/45">
                <td className="max-w-96 p-3">
                  <div className="flex items-center gap-2">
                    {row.imageThumbUrl && (
                      <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                        <Image src={row.imageThumbUrl} alt={`Image from ${row.author.label}`} fill sizes="32px" className="object-cover" unoptimized />
                      </span>
                    )}
                    {row.body ? (
                      <span className="truncate">{row.body}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-muted-foreground italic">
                        <ImageIcon className="h-3.5 w-3.5" aria-hidden /> Image only
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <p className="font-medium">
                    {row.author.label}
                    {row.author.isAdmin && (
                      <Badge variant="default" className="ml-1.5 align-middle text-[10px]">
                        Staff
                      </Badge>
                    )}
                  </p>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={STATUS_BADGE[row.status].variant}>{STATUS_BADGE[row.status].label}</Badge>
                    {row.linkPending && <Badge variant="warning">Pending link approval</Badge>}
                  </div>
                </td>
                <td className="p-3 whitespace-nowrap text-muted-foreground">
                  <span suppressHydrationWarning>{formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}</span>
                </td>
                <td className="p-3">
                  <MessageActions row={row} mode={mode} onModerate={onModerate} onApprove={onApprove} onReject={onReject} />
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
