"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { safeAction } from "@/lib/admin-action";
import { setTelegramUserBlockedAction } from "@/server/actions/admin-telegram";

export interface Row {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  blocked: boolean;
  botBlocked: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  courseViews: number;
  downloadRequests: number;
  completedDownloads: number;
}

// Fixed format + UTC: a locale-dependent render would differ between the
// server and the client and trip a hydration mismatch.
const FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
});
const fmt = (iso: string) => FMT.format(new Date(iso));

export function TelegramUsersTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [local, setLocal] = React.useState(rows);
  React.useEffect(() => setLocal(rows), [rows]);

  async function toggle(row: Row) {
    if (pending) return;
    setPending(row.id);
    const next = !row.blocked;
    // Optimistic, reverted if the server disagrees.
    setLocal((prev) => prev.map((r) => (r.id === row.id ? { ...r, blocked: next } : r)));
    const result = await safeAction(() => setTelegramUserBlockedAction(row.id, next));
    if (result.ok) {
      toast.success(next ? "User blocked" : "User unblocked");
      router.refresh();
    } else {
      setLocal((prev) => prev.map((r) => (r.id === row.id ? { ...r, blocked: row.blocked } : r)));
      toast.error(result.error);
    }
    setPending(null);
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
            <th className="p-3 font-medium">User</th>
            <th className="p-3 font-medium">Telegram ID</th>
            <th className="p-3 font-medium">First seen</th>
            <th className="p-3 font-medium">Last seen</th>
            <th className="p-3 text-right font-medium">Views</th>
            <th className="p-3 text-right font-medium">Requests</th>
            <th className="p-3 text-right font-medium">Downloads</th>
            <th className="p-3 font-medium">Status</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {local.map((r) => {
            const name = [r.firstName, r.lastName].filter(Boolean).join(" ");
            return (
              <tr key={r.id} className="border-b border-border/60 last:border-0">
                <td className="p-3">
                  <div className="font-medium">{name || "—"}</div>
                  {r.username && <div className="text-xs text-muted-foreground">@{r.username}</div>}
                </td>
                <td className="p-3 font-mono text-xs whitespace-nowrap">{r.telegramId}</td>
                <td className="p-3 whitespace-nowrap text-muted-foreground">{fmt(r.firstSeenAt)}</td>
                <td className="p-3 whitespace-nowrap text-muted-foreground">{fmt(r.lastSeenAt)}</td>
                <td className="p-3 text-right tabular-nums">{r.courseViews}</td>
                <td className="p-3 text-right tabular-nums">{r.downloadRequests}</td>
                <td className="p-3 text-right tabular-nums">{r.completedDownloads}</td>
                <td className="p-3">
                  {r.blocked ? (
                    <Badge variant="warning">Blocked</Badge>
                  ) : r.botBlocked ? (
                    <Badge variant="secondary">Blocked the bot</Badge>
                  ) : (
                    <Badge variant="success">Active</Badge>
                  )}
                </td>
                <td className="p-3 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending !== null}
                    onClick={() => void toggle(r)}
                    className={r.blocked ? "" : "text-destructive hover:bg-destructive/10"}
                  >
                    {pending === r.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : r.blocked ? (
                      <Check className="h-4 w-4" aria-hidden />
                    ) : (
                      <Ban className="h-4 w-4" aria-hidden />
                    )}
                    {r.blocked ? "Unblock" : "Block"}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
