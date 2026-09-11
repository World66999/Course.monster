import type { Metadata } from "next";
import { Activity } from "lucide-react";
import { db } from "@/lib/db";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/site/section";

export const metadata: Metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

function actionVariant(action: string): "default" | "success" | "warning" | "secondary" {
  if (action.endsWith(".delete") || action === "login.failed") return "warning";
  if (action.endsWith(".create") || action.endsWith(".publish")) return "success";
  if (action.endsWith(".update")) return "default";
  return "secondary";
}

export default async function AdminActivityPage() {
  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every admin action is recorded here (most recent 200 shown).
        </p>
      </div>

      {logs.length === 0 ? (
        <EmptyState
          icon={<Activity aria-hidden />}
          title="No activity yet"
          description="Admin actions like creating and editing courses will appear here."
        />
      ) : (
        <div className="relative overflow-x-auto rounded-card border border-border bg-card shadow-soft">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                <th className="p-3 font-medium">Action</th>
                <th className="p-3 font-medium">User</th>
                <th className="p-3 font-medium">Details</th>
                <th className="p-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const meta = log.meta as Record<string, unknown> | null;
                const detail =
                  meta && typeof meta.title === "string"
                    ? meta.title
                    : meta && typeof meta.name === "string"
                      ? meta.name
                      : meta && typeof meta.count === "number"
                        ? `${meta.count} items`
                        : (log.entityId ?? "—");
                return (
                  <tr key={log.id} className="border-b border-border last:border-0">
                    <td className="p-3">
                      <Badge variant={actionVariant(log.action)}>{log.action}</Badge>
                    </td>
                    <td className="p-3">{log.user?.name ?? "System"}</td>
                    <td className="max-w-64 truncate p-3 text-muted-foreground">{detail}</td>
                    <td className="p-3 whitespace-nowrap text-muted-foreground" suppressHydrationWarning>
                      {formatDistanceToNow(log.createdAt, { addSuffix: true })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
