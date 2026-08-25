"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeAction } from "@/lib/safe-action";
import { cancelSocialJobAction, retrySocialJobAction } from "@/server/actions/admin-social";

/**
 * Operator view of website download jobs.
 *
 * Deliberately absent from every row: the submitted URL, any filesystem path,
 * and any credential. The site stores a SHA-256 of the URL and nothing else, so
 * there is no URL here to leak — the hash prefix is shown purely so an operator
 * can tell two jobs apart and spot the same link being retried.
 */

export interface JobRow {
  id: string;
  platform: string;
  status: string;
  title: string | null;
  fileName: string | null;
  fileSize: number;
  errorCode: string | null;
  urlHashPrefix: string;
  userName: string;
  userEmail: string;
  createdAt: string;
  completedAt: string | null;
}

const FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  timeZone: "UTC", hour12: false,
});
const fmt = (iso: string) => FMT.format(new Date(iso));

function size(bytes: number): string {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

const ACTIVE = new Set(["QUEUED", "PROCESSING"]);

function statusBadge(status: string) {
  if (status === "COMPLETED") return <Badge variant="success">Completed</Badge>;
  if (ACTIVE.has(status)) return <Badge variant="default">{status === "QUEUED" ? "Queued" : "Processing"}</Badge>;
  if (status === "FAILED") return <Badge variant="warning">Failed</Badge>;
  return <Badge variant="secondary">{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
}

const STATUSES = ["ALL", "QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED", "EXPIRED"];

export function SocialJobsTable({
  rows,
  platforms,
}: {
  rows: JobRow[];
  platforms: string[];
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("ALL");
  const [platform, setPlatform] = React.useState("ALL");

  // Filtering is client-side over an already-bounded page of rows, so it stays
  // instant and cannot be used to probe for rows the server did not send.
  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "ALL" && r.status !== status) return false;
      if (platform !== "ALL" && r.platform !== platform) return false;
      if (!needle) return true;
      return (
        r.userName.toLowerCase().includes(needle) ||
        r.userEmail.toLowerCase().includes(needle) ||
        (r.title ?? "").toLowerCase().includes(needle) ||
        (r.fileName ?? "").toLowerCase().includes(needle) ||
        r.urlHashPrefix.includes(needle)
      );
    });
  }, [rows, q, status, platform]);

  async function run(
    id: string,
    action: () => Promise<{ ok: boolean; error?: string }>,
    okMessage: string
  ) {
    if (pending) return;
    setPending(id);
    const result = await safeAction(action);
    if (result.ok) {
      toast.success(okMessage);
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setPending(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search member, title, filename or hash…"
          className="sm:max-w-xs"
          aria-label="Search jobs"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "ALL" ? "All statuses" : s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          aria-label="Filter by platform"
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="ALL">All platforms</option>
          {platforms.map((p) => (
            <option key={p} value={p}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground sm:ml-auto">
          {filtered.length} of {rows.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
              <th className="p-3 font-medium">Member</th>
              <th className="p-3 font-medium">Platform</th>
              <th className="p-3 font-medium">Result</th>
              <th className="p-3 text-right font-medium">Size</th>
              <th className="p-3 font-medium">Started</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-border/60 last:border-0">
                <td className="p-3">
                  <div className="font-medium">{r.userName}</div>
                  <div className="text-xs text-muted-foreground">{r.userEmail}</div>
                </td>
                <td className="p-3">
                  <div className="capitalize">{r.platform}</div>
                  <div className="font-mono text-xs text-muted-foreground" title="URL hash prefix">
                    {r.urlHashPrefix}
                  </div>
                </td>
                <td className="max-w-[22rem] p-3">
                  <div className="truncate">{r.title ?? "—"}</div>
                  {r.errorCode && (
                    <div className="text-xs text-warning">{r.errorCode}</div>
                  )}
                </td>
                <td className="p-3 text-right tabular-nums whitespace-nowrap">{size(r.fileSize)}</td>
                <td className="p-3 whitespace-nowrap text-muted-foreground">{fmt(r.createdAt)}</td>
                <td className="p-3">{statusBadge(r.status)}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    {ACTIVE.has(r.status) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending === r.id}
                        onClick={() =>
                          run(r.id, () => cancelSocialJobAction(r.id), "Job cancelled")
                        }
                      >
                        {pending === r.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <XCircle className="h-4 w-4" aria-hidden />
                        )}
                        Cancel
                      </Button>
                    )}
                    {!ACTIVE.has(r.status) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending === r.id}
                        title="Only possible while the downloader still holds the original link"
                        onClick={() => run(r.id, () => retrySocialJobAction(r.id), "Retry started")}
                      >
                        {pending === r.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <RotateCcw className="h-4 w-4" aria-hidden />
                        )}
                        Retry
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  No jobs match those filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
