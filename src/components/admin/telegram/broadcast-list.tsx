"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pause, Play, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { safeAction } from "@/lib/admin-action";
import {
  cancelBroadcastAction,
  pauseBroadcastAction,
  resumeBroadcastAction,
} from "@/server/actions/admin-telegram";

export interface BroadcastRow {
  id: string;
  body: string;
  status: string;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  createdAt: string;
}

const FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
});

const VARIANT: Record<string, "success" | "secondary" | "warning"> = {
  COMPLETED: "success",
  SENDING: "secondary",
  QUEUED: "secondary",
  PAUSED: "secondary",
  DRAFT: "secondary",
  CANCELLED: "warning",
  FAILED: "warning",
};

export function BroadcastList({ rows }: { rows: BroadcastRow[] }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);

  // A running broadcast advances server-side; refresh so progress is visible.
  React.useEffect(() => {
    if (!rows.some((r) => r.status === "SENDING" || r.status === "QUEUED")) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [rows, router]);

  async function act(id: string, fn: (id: string) => Promise<{ ok: boolean; error?: string }>, msg: string) {
    if (pending) return;
    setPending(id);
    const result = await safeAction(() => fn(id));
    if (result.ok) { toast.success(msg); router.refresh(); } else { toast.error(result.error); }
    setPending(null);
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No broadcasts sent yet.</p>;
  }

  return (
    <div className="space-y-3">
      <h2 className="font-semibold">Recent broadcasts</h2>
      {rows.map((r) => {
        const done = r.sentCount + r.failedCount + r.skippedCount;
        const pct = r.totalCount > 0 ? Math.round((done / r.totalCount) * 100) : 0;
        const live = r.status === "SENDING" || r.status === "QUEUED";
        return (
          <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm">{r.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{FMT.format(new Date(r.createdAt))}</p>
              </div>
              <Badge variant={VARIANT[r.status] ?? "secondary"}>{r.status}</Badge>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {done}/{r.totalCount} processed · {r.sentCount} sent · {r.failedCount} failed ·{" "}
              {r.skippedCount} skipped
            </p>

            {(live || r.status === "PAUSED") && (
              <div className="mt-3 flex flex-wrap gap-2">
                {live && (
                  <Button type="button" variant="outline" size="sm" disabled={pending !== null}
                    onClick={() => void act(r.id, pauseBroadcastAction, "Broadcast paused")}>
                    {pending === r.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Pause className="h-4 w-4" aria-hidden />}
                    Pause
                  </Button>
                )}
                {r.status === "PAUSED" && (
                  <Button type="button" variant="outline" size="sm" disabled={pending !== null}
                    onClick={() => void act(r.id, resumeBroadcastAction, "Broadcast resumed")}>
                    <Play className="h-4 w-4" aria-hidden />
                    Resume
                  </Button>
                )}
                <Button type="button" variant="ghost" size="sm" disabled={pending !== null}
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => void act(r.id, cancelBroadcastAction, "Broadcast cancelled")}>
                  <X className="h-4 w-4" aria-hidden />
                  Cancel
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
