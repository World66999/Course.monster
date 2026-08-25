"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  EyeOff,
  ImageIcon,
  Loader2,
  Lock,
  LockOpen,
  Merge,
  Pin,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button, buttonClasses } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  moderateCourseRequestAction,
  changeRequestStatusAction,
  togglePinRequestAction,
  toggleFeatureRequestAction,
  toggleCommentsLockAction,
  removeRequestImageAction,
  mergeRequestAction,
} from "@/server/actions/admin-course-requests";
import { REQUEST_STATUS_LABELS, REQUEST_KIND_LABELS, type RequestStatus, type RequestKind } from "@/lib/request-shared";
import { safeAction } from "@/lib/safe-action";

export interface AdminRequestRow {
  id: string;
  slug: string;
  title: string;
  imageThumbUrl: string | null;
  kind: RequestKind;
  status: RequestStatus;
  moderationStatus: "VISIBLE" | "HIDDEN" | "DELETED";
  pinned: boolean;
  featured: boolean;
  commentsLocked: boolean;
  voteCount: number;
  commentCount: number;
  createdAt: string;
  author: { label: string };
}

const MODERATION_BADGE = {
  VISIBLE: { label: "Visible", variant: "success" as const },
  HIDDEN: { label: "Hidden", variant: "warning" as const },
  DELETED: { label: "Deleted", variant: "secondary" as const },
};

const ALL = "__all__";
const STATUS_OPTIONS = Object.keys(REQUEST_STATUS_LABELS) as RequestStatus[];
const KIND_OPTIONS = Object.keys(REQUEST_KIND_LABELS) as RequestKind[];

function RowActions({
  row,
  onModerate,
  onStatusChange,
  onTogglePin,
  onToggleFeature,
  onToggleLock,
  onRemoveImage,
  onMerge,
}: {
  row: AdminRequestRow;
  onModerate: (id: string, status: "VISIBLE" | "HIDDEN" | "DELETED") => Promise<void>;
  onStatusChange: (id: string, status: RequestStatus) => Promise<void>;
  onTogglePin: (id: string) => Promise<void>;
  onToggleFeature: (id: string) => Promise<void>;
  onToggleLock: (id: string) => Promise<void>;
  onRemoveImage: (id: string) => Promise<void>;
  onMerge: (id: string) => Promise<void>;
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

  return (
    <div className="flex flex-wrap justify-end gap-1">
      <Select value={row.status} onValueChange={(v) => run(() => onStatusChange(row.id, v as RequestStatus))}>
        <SelectTrigger aria-label="Change status" className="h-8 w-36 text-xs" disabled={busy}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((s) => (
            <SelectItem key={s} value={s}>
              {REQUEST_STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="icon"
        aria-label={row.pinned ? "Unpin" : "Pin"}
        disabled={busy}
        onClick={() => run(() => onTogglePin(row.id))}
        className={row.pinned ? "text-primary" : undefined}
      >
        <Pin className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={row.featured ? "Unfeature" : "Feature"}
        disabled={busy}
        onClick={() => run(() => onToggleFeature(row.id))}
        className={row.featured ? "text-primary" : undefined}
      >
        <Sparkles className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={row.commentsLocked ? "Unlock comments" : "Lock comments"}
        disabled={busy}
        onClick={() => run(() => onToggleLock(row.id))}
        className={row.commentsLocked ? "text-warning" : undefined}
      >
        {row.commentsLocked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
      </Button>
      {row.imageThumbUrl && (
        <Button variant="ghost" size="icon" aria-label="Remove image" disabled={busy} onClick={() => run(() => onRemoveImage(row.id))}>
          <ImageIcon className="h-4 w-4" />
        </Button>
      )}
      <Button variant="ghost" size="icon" aria-label="Merge into another request" disabled={busy} onClick={() => run(() => onMerge(row.id))}>
        <Merge className="h-4 w-4" />
      </Button>

      {row.moderationStatus !== "VISIBLE" && (
        <Button variant="ghost" size="icon" aria-label="Restore" disabled={busy} onClick={() => run(() => onModerate(row.id, "VISIBLE"))}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
        </Button>
      )}
      {row.moderationStatus !== "HIDDEN" && (
        <Button variant="ghost" size="icon" aria-label="Hide" disabled={busy} onClick={() => run(() => onModerate(row.id, "HIDDEN"))}>
          <EyeOff className="h-4 w-4" />
        </Button>
      )}
      {row.moderationStatus !== "DELETED" && (
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

export function RequestModerationTable({
  rows,
  page,
  pageCount,
}: {
  rows: AdminRequestRow[];
  page: number;
  pageCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = React.useState(searchParams.get("q") ?? "");
  const [localRows, setLocalRows] = React.useState(rows);
  const [, startTransition] = React.useTransition();
  type Action =
    | { type: "moderate"; id: string; status: "VISIBLE" | "HIDDEN" | "DELETED" }
    | { type: "status"; id: string; status: RequestStatus }
    | { type: "pin"; id: string }
    | { type: "feature"; id: string }
    | { type: "lock"; id: string }
    | { type: "removeImage"; id: string };
  const [optimisticRows, applyOptimistic] = React.useOptimistic(localRows, (state: AdminRequestRow[], action: Action) => {
    switch (action.type) {
      case "moderate":
        return state.map((r) => (r.id === action.id ? { ...r, moderationStatus: action.status } : r));
      case "status":
        return state.map((r) => (r.id === action.id ? { ...r, status: action.status } : r));
      case "pin":
        return state.map((r) => (r.id === action.id ? { ...r, pinned: !r.pinned } : r));
      case "feature":
        return state.map((r) => (r.id === action.id ? { ...r, featured: !r.featured } : r));
      case "lock":
        return state.map((r) => (r.id === action.id ? { ...r, commentsLocked: !r.commentsLocked } : r));
      case "removeImage":
        return state.map((r) => (r.id === action.id ? { ...r, imageThumbUrl: null } : r));
    }
  });

  React.useEffect(() => setLocalRows(rows), [rows]);

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

  const currentStatus = searchParams.get("modStatus") ?? "";
  const currentKind = searchParams.get("kind") ?? "";

  async function onModerate(id: string, status: "VISIBLE" | "HIDDEN" | "DELETED") {
    startTransition(() => applyOptimistic({ type: "moderate", id, status }));
    const result = await safeAction(() => moderateCourseRequestAction(id, status));
    if (!result.ok) {
      toast.error(result.error ?? "Something went wrong");
      return;
    }
    toast.success(status === "VISIBLE" ? "Restored" : status === "HIDDEN" ? "Hidden" : "Deleted");
    setLocalRows((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, moderationStatus: status } : r));
      return currentStatus && currentStatus !== status ? next.filter((r) => r.id !== id) : next;
    });
  }

  async function onStatusChange(id: string, status: RequestStatus) {
    startTransition(() => applyOptimistic({ type: "status", id, status }));
    const result = await safeAction(() => changeRequestStatusAction(id, status));
    if (!result.ok) {
      toast.error(result.error ?? "Something went wrong");
      return;
    }
    toast.success(`Status set to ${REQUEST_STATUS_LABELS[status]}`);
    setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  async function onTogglePin(id: string) {
    startTransition(() => applyOptimistic({ type: "pin", id }));
    const result = await safeAction(() => togglePinRequestAction(id));
    if (!result.ok) {
      toast.error(result.error ?? "Something went wrong");
      return;
    }
    setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, pinned: !r.pinned } : r)));
  }

  async function onToggleFeature(id: string) {
    startTransition(() => applyOptimistic({ type: "feature", id }));
    const result = await safeAction(() => toggleFeatureRequestAction(id));
    if (!result.ok) {
      toast.error(result.error ?? "Something went wrong");
      return;
    }
    setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, featured: !r.featured } : r)));
  }

  async function onToggleLock(id: string) {
    startTransition(() => applyOptimistic({ type: "lock", id }));
    const result = await safeAction(() => toggleCommentsLockAction(id));
    if (!result.ok) {
      toast.error(result.error ?? "Something went wrong");
      return;
    }
    setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, commentsLocked: !r.commentsLocked } : r)));
  }

  async function onRemoveImage(id: string) {
    startTransition(() => applyOptimistic({ type: "removeImage", id }));
    const result = await safeAction(() => removeRequestImageAction(id));
    if (!result.ok) {
      toast.error(result.error ?? "Something went wrong");
      return;
    }
    toast.success("Image removed");
    setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, imageThumbUrl: null } : r)));
  }

  async function onMerge(id: string) {
    const targetId = window.prompt("Enter the ID of the request to merge this into:");
    if (!targetId) return;
    const result = await safeAction(() => mergeRequestAction(id, targetId.trim()));
    if (!result.ok) {
      toast.error(result.error ?? "Something went wrong");
      return;
    }
    toast.success("Merged");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search requests…" className="pl-9" />
        </div>
        <div className="w-44">
          <Select value={currentStatus || ALL} onValueChange={(v) => update({ modStatus: v === ALL ? "" : v })}>
            <SelectTrigger aria-label="Filter by moderation status">
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
        <div className="w-44">
          <Select value={currentKind || ALL} onValueChange={(v) => update({ kind: v === ALL ? "" : v })}>
            <SelectTrigger aria-label="Filter by type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              {KIND_OPTIONS.map((k) => (
                <SelectItem key={k} value={k}>
                  {REQUEST_KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="relative overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs tracking-wider text-muted-foreground uppercase">
              <th className="p-3 font-medium">Request</th>
              <th className="p-3 font-medium">Type</th>
              <th className="p-3 font-medium">Author</th>
              <th className="p-3 font-medium">Moderation</th>
              <th className="p-3 font-medium">Votes</th>
              <th className="p-3 font-medium">Comments</th>
              <th className="p-3 font-medium">Posted</th>
              <th className="w-96 p-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {optimisticRows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-10 text-center text-muted-foreground">
                  No requests match your filters.
                </td>
              </tr>
            )}
            {optimisticRows.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="max-w-72 p-3">
                  <div className="flex items-center gap-2">
                    {row.imageThumbUrl && (
                      <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                        <Image src={row.imageThumbUrl} alt={row.title} fill sizes="32px" className="object-cover" unoptimized />
                      </span>
                    )}
                    <span className="truncate font-medium">{row.title}</span>
                  </div>
                </td>
                <td className="p-3">
                  <Badge variant={row.kind === "RECOMMENDATION" ? "success" : "default"}>
                    {REQUEST_KIND_LABELS[row.kind]}
                  </Badge>
                </td>
                <td className="p-3">{row.author.label}</td>
                <td className="p-3">
                  <Badge variant={MODERATION_BADGE[row.moderationStatus].variant}>
                    {MODERATION_BADGE[row.moderationStatus].label}
                  </Badge>
                </td>
                <td className="p-3 tabular-nums">{row.voteCount}</td>
                <td className="p-3 tabular-nums">{row.commentCount}</td>
                <td className="p-3 whitespace-nowrap text-muted-foreground">
                  <span suppressHydrationWarning>{formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}</span>
                </td>
                <td className="p-3">
                  <RowActions
                    row={row}
                    onModerate={onModerate}
                    onStatusChange={onStatusChange}
                    onTogglePin={onTogglePin}
                    onToggleFeature={onToggleFeature}
                    onToggleLock={onToggleLock}
                    onRemoveImage={onRemoveImage}
                    onMerge={onMerge}
                  />
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
