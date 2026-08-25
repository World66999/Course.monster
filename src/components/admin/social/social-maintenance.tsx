"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eraser, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { safeAction } from "@/lib/safe-action";
import { pruneSocialJobsAction, sweepSocialJobsAction } from "@/server/actions/admin-social";

/**
 * Maintenance controls.
 *
 * Both are safe by construction: the sweep only removes artefacts the service
 * has already finished with, and the prune only removes job rows in a terminal
 * state older than a bounded window. Neither can touch a running job.
 */
export function SocialMaintenance() {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"sweep" | "prune" | null>(null);
  const [days, setDays] = React.useState(90);

  async function sweep() {
    if (busy) return;
    setBusy("sweep");
    const result = await safeAction(() => sweepSocialJobsAction());
    if (result.ok) {
      toast.success("Expired artefacts and orphan files cleaned up");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(null);
  }

  async function prune() {
    if (busy) return;
    setBusy("prune");
    const result = await safeAction(() => pruneSocialJobsAction(days));
    if (result.ok) {
      toast.success(`Finished jobs older than ${days} days removed`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setBusy(null);
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div>
        <h2 className="font-semibold">Maintenance</h2>
        <p className="text-sm text-muted-foreground">
          Housekeeping runs automatically every five minutes. These are the manual equivalents.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <p className="text-sm font-medium">Clean up now</p>
          <p className="text-xs text-muted-foreground">
            Expires finished downloads past their time limit and deletes orphan files.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={sweep} disabled={busy !== null} className="sm:ml-auto">
          {busy === "sweep" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Eraser className="h-4 w-4" aria-hidden />
          )}
          Run cleanup
        </Button>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <p className="text-sm font-medium">Prune old job history</p>
          <p className="text-xs text-muted-foreground">
            Removes finished job records only. Running jobs are never affected.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <label className="text-sm text-muted-foreground" htmlFor="prune-days">
            Older than
          </label>
          <select
            id="prune-days"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
          >
            {[30, 90, 180, 365].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" onClick={prune} disabled={busy !== null}>
            {busy === "prune" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="h-4 w-4" aria-hidden />
            )}
            Prune
          </Button>
        </div>
      </div>
    </div>
  );
}
