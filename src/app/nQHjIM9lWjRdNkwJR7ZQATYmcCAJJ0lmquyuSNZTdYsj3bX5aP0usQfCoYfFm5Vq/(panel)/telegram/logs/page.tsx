import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/site/section";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Telegram logs" };
export const dynamic = "force-dynamic";

export default async function TelegramLogsPage() {
  const events = await db.telegramEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true, type: true, query: true, createdAt: true,
      course: { select: { title: true } },
      user: { select: { telegramId: true, username: true } },
    },
  });

  if (events.length === 0) {
    return (
      <EmptyState
        icon={<ScrollText aria-hidden />}
        title="No bot activity yet"
        description="Interactions with the bot are recorded here."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-card shadow-soft">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
            <th className="p-3 font-medium">When</th>
            <th className="p-3 font-medium">Event</th>
            <th className="p-3 font-medium">User</th>
            <th className="p-3 font-medium">Detail</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-b border-border/60 last:border-0">
              <td className="p-3 whitespace-nowrap text-muted-foreground">{formatDate(e.createdAt)}</td>
              <td className="p-3">
                <Badge variant={e.type === "ERROR" ? "warning" : "secondary"}>{e.type}</Badge>
              </td>
              <td className="p-3 whitespace-nowrap">
                {e.user.username ? `@${e.user.username}` : e.user.telegramId}
              </td>
              <td className="p-3 text-muted-foreground">{e.course?.title ?? e.query ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
