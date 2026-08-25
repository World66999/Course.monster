"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { moderateContentAction, resolveReportAction, dismissReportAction } from "@/server/actions/moderation";
import { Button } from "@/components/ui/button";
import { safeAction } from "@/lib/safe-action";

type ModerationStatus = "VISIBLE" | "HIDDEN" | "DELETED";

export function ModerationActions({
  kind,
  id,
  status,
}: {
  kind: "comment" | "review";
  id: string;
  status: ModerationStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function run(next: ModerationStatus, success: string) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await safeAction(() => moderateContentAction(kind, id, next));
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(result.error ?? "Something went wrong");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex justify-end gap-1">
      {status !== "VISIBLE" && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Restore"
          disabled={busy}
          onClick={() => run("VISIBLE", "Restored")}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
        </Button>
      )}
      {status !== "HIDDEN" && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Hide"
          disabled={busy}
          onClick={() => run("HIDDEN", "Hidden")}
        >
          <EyeOff className="h-4 w-4" />
        </Button>
      )}
      {status !== "DELETED" && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete"
          className="text-destructive hover:bg-destructive/10"
          disabled={busy}
          onClick={() => run("DELETED", "Deleted")}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export function ReportActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await fn();
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(result.error ?? "Something went wrong");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => dismissReportAction(id), "Dismissed")}>
        Dismiss
      </Button>
      <Button size="sm" disabled={busy} onClick={() => run(() => resolveReportAction(id), "Resolved")}>
        Resolve
      </Button>
    </div>
  );
}
