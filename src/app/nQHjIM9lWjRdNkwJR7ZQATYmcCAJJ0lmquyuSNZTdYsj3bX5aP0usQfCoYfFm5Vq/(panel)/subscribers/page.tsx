import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/site/section";

export const metadata: Metadata = { title: "Subscribers" };
export const dynamic = "force-dynamic";

export default async function AdminSubscribersPage() {
  const subscribers = await db.newsletterSubscriber.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Newsletter subscribers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {subscribers.length} subscriber{subscribers.length === 1 ? "" : "s"} (most recent 500
          shown)
        </p>
      </div>

      {subscribers.length === 0 ? (
        <EmptyState
          icon={<Mail aria-hidden />}
          title="No subscribers yet"
          description="Signups from the footer newsletter form will appear here."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                <th className="p-3 font-medium">Email</th>
                <th className="p-3 font-medium">Subscribed</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium">{s.email}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
