"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2, Search, ShieldOff, VolumeX, Volume2, RotateCcw } from "lucide-react";
import { toast } from "@/lib/toast";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button, buttonClasses } from "@/components/ui/button";
import { safeAction } from "@/lib/safe-action";
import { useAdminParams, useDebouncedParam } from "@/components/admin/use-admin-params";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  banUserFromChatAction,
  unbanUserFromChatAction,
  muteUserAction,
  unmuteUserAction,
} from "@/server/actions/admin-chat";

export interface ChatUserRow {
  id: string;
  name: string;
  chatDisplayName: string | null;
  role: "ADMIN" | "EDITOR" | "USER";
  chatBanned: boolean;
  chatMutedUntil: string | null;
  createdAt: string;
}

const MUTE_OPTIONS = [
  { label: "5 minutes", minutes: 5 },
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "1 day", minutes: 60 * 24 },
  { label: "7 days", minutes: 60 * 24 * 7 },
];

function RowActions({
  row,
  onBan,
  onUnban,
  onMute,
  onUnmute,
}: {
  row: ChatUserRow;
  onBan: (id: string) => Promise<void>;
  onUnban: (id: string) => Promise<void>;
  onMute: (id: string, minutes: number) => Promise<void>;
  onUnmute: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = React.useState(false);
  const [muteMinutes, setMuteMinutes] = React.useState(String(MUTE_OPTIONS[1].minutes));
  const isMuted = row.chatMutedUntil !== null && new Date(row.chatMutedUntil).getTime() > Date.now();

  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  if (row.role !== "USER") {
    return <span className="text-xs text-muted-foreground">Staff</span>;
  }

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {isMuted ? (
        <Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => onUnmute(row.id))}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
          Unmute
        </Button>
      ) : (
        <div className="flex items-center gap-1">
          <Select value={muteMinutes} onValueChange={setMuteMinutes}>
            <SelectTrigger aria-label="Mute duration" className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MUTE_OPTIONS.map((opt) => (
                <SelectItem key={opt.minutes} value={String(opt.minutes)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => run(() => onMute(row.id, Number(muteMinutes)))}
          >
            <VolumeX className="h-3.5 w-3.5" />
            Mute
          </Button>
        </div>
      )}
      {row.chatBanned ? (
        <Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => onUnban(row.id))}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          Unban
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10"
          disabled={busy}
          onClick={() => run(() => onBan(row.id))}
        >
          <ShieldOff className="h-3.5 w-3.5" />
          Ban
        </Button>
      )}
    </div>
  );
}

export function ChatUsersTable({
  rows,
  page,
  pageCount,
}: {
  rows: ChatUserRow[];
  page: number;
  pageCount: number;
}) {
  const { searchParams, update, goToPage, isPending } = useAdminParams();
  const [q, setQ] = useDebouncedParam("uq", update, searchParams);
  const [localRows, setLocalRows] = React.useState(rows);
  const [, startTransition] = React.useTransition();
  const [optimisticRows, applyOptimistic] = React.useOptimistic(
    localRows,
    (
      state: ChatUserRow[],
      action:
        | { type: "ban" | "unban"; id: string }
        | { type: "mute"; id: string; until: string }
        | { type: "unmute"; id: string }
    ) => {
      switch (action.type) {
        case "ban":
          return state.map((r) => (r.id === action.id ? { ...r, chatBanned: true } : r));
        case "unban":
          return state.map((r) => (r.id === action.id ? { ...r, chatBanned: false } : r));
        case "mute":
          return state.map((r) => (r.id === action.id ? { ...r, chatMutedUntil: action.until } : r));
        case "unmute":
          return state.map((r) => (r.id === action.id ? { ...r, chatMutedUntil: null } : r));
      }
    }
  );

  // Re-sync when pagination/search produce a new server-fetched page.
  React.useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  async function onBan(id: string) {
    startTransition(() => applyOptimistic({ type: "ban", id }));
    const result = await safeAction(() => banUserFromChatAction(id));
    if (!result.ok) {
      toast.error(result.error ?? "Something went wrong");
      return;
    }
    toast.success("Banned");
    setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, chatBanned: true } : r)));
  }

  async function onUnban(id: string) {
    startTransition(() => applyOptimistic({ type: "unban", id }));
    const result = await safeAction(() => unbanUserFromChatAction(id));
    if (!result.ok) {
      toast.error(result.error ?? "Something went wrong");
      return;
    }
    toast.success("Unbanned");
    setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, chatBanned: false } : r)));
  }

  async function onMute(id: string, minutes: number) {
    const until = new Date(Date.now() + minutes * 60_000).toISOString();
    startTransition(() => applyOptimistic({ type: "mute", id, until }));
    const result = await safeAction(() => muteUserAction(id, minutes));
    if (!result.ok) {
      toast.error(result.error ?? "Something went wrong");
      return;
    }
    toast.success("Muted");
    setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, chatMutedUntil: until } : r)));
  }

  async function onUnmute(id: string) {
    startTransition(() => applyOptimistic({ type: "unmute", id }));
    const result = await safeAction(() => unmuteUserAction(id));
    if (!result.ok) {
      toast.error(result.error ?? "Something went wrong");
      return;
    }
    toast.success("Unmuted");
    setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, chatMutedUntil: null } : r)));
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
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs tracking-wider text-muted-foreground uppercase">
              <th className="p-3 font-medium">User</th>
              <th className="p-3 font-medium">Chat status</th>
              <th className="p-3 font-medium">Joined</th>
              <th className="w-64 p-3">
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
            {optimisticRows.map((row) => {
              const isMuted = row.chatMutedUntil !== null && new Date(row.chatMutedUntil).getTime() > Date.now();
              return (
                <tr key={row.id} className="border-b border-border transition-colors duration-150 last:border-0 hover:bg-primary-soft/45">
                  <td className="p-3">
                    <p className="font-medium">{row.name}</p>
                    {row.chatDisplayName && (
                      <p className="text-xs text-muted-foreground">chat: {row.chatDisplayName}</p>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {row.chatBanned && (
                        <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
                          Banned
                        </Badge>
                      )}
                      {isMuted && (
                        <Badge variant="warning">
                          <span suppressHydrationWarning>Muted {formatDistanceToNow(new Date(row.chatMutedUntil!), { addSuffix: true })}</span>
                        </Badge>
                      )}
                      {!row.chatBanned && !isMuted && <Badge variant="success">Active</Badge>}
                    </div>
                  </td>
                  <td className="p-3 whitespace-nowrap text-muted-foreground">
                    <span suppressHydrationWarning>{formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}</span>
                  </td>
                  <td className="p-3">
                    <RowActions row={row} onBan={onBan} onUnban={onUnban} onMute={onMute} onUnmute={onUnmute} />
                  </td>
                </tr>
              );
            })}
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
