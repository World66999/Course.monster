import type { Metadata } from "next";
import Link from "next/link";
import type { TicketStatus } from "@prisma/client";
import { Star } from "lucide-react";
import { db } from "@/lib/db";
import { adminPath } from "@/lib/admin-path";
import { TICKET_STATUS, TICKET_TOPIC } from "@/lib/support-labels";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Support inbox" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const TABS: { key: TicketStatus | "ALL"; label: string }[] = [
  { key: "OPEN", label: "Open" },
  { key: "ANSWERED", label: "Answered" },
  { key: "CLOSED", label: "Closed" },
  { key: "ALL", label: "All" },
];

export default async function AdminSupportPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const tabRaw = (Array.isArray(raw.status) ? raw.status[0] : raw.status) ?? "OPEN";
  const tab = TABS.some((t) => t.key === tabRaw) ? (tabRaw as TicketStatus | "ALL") : "OPEN";

  // Priority is whether the author is Premium *now*, read live from
  // premiumUntil, so a lapsed member drops out of the priority lane at once.
  // Priority tickets first, then most recent activity.
  const now = new Date();
  const where = tab === "ALL" ? {} : { status: tab };
  const select = {
    id: true,
    subject: true,
    topic: true,
    status: true,
    lastMessageAt: true,
    user: { select: { email: true, name: true } },
    _count: { select: { messages: true } },
  } as const;
  const [priorityTickets, otherTickets] = await Promise.all([
    db.supportTicket.findMany({
      where: { ...where, user: { premiumUntil: { gt: now } } },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
      select,
    }),
    db.supportTicket.findMany({
      where: { ...where, user: { OR: [{ premiumUntil: null }, { premiumUntil: { lte: now } }] } },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
      select,
    }),
  ]);
  const tickets = [
    ...priorityTickets.map((t) => ({ ...t, priority: true })),
    ...otherTickets.map((t) => ({ ...t, priority: false })),
  ].slice(0, 100);
  const counts = await db.supportTicket.groupBy({ by: ["status"], _count: true });
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading">Support inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">Premium Purchase Support tickets. Premium members are marked Priority and sorted first.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`?status=${t.key}`}
            className={`rounded-full border px-3.5 py-1.5 text-sm ${tab === t.key ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
            {t.key !== "ALL" && <span className="ml-1.5 text-xs opacity-75">{countOf(t.key)}</span>}
          </Link>
        ))}
      </div>
      <div className="overflow-hidden rounded-card border border-border bg-card shadow-soft">
        {tickets.length === 0 && <p className="p-10 text-center text-muted-foreground">Nothing here.</p>}
        <ul>
          {tickets.map((t) => (
            <li key={t.id} className="border-b border-border last:border-0">
              <Link href={adminPath(`support/${t.id}`)} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-primary-soft/40">
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-medium">
                    {t.priority && (
                      <Badge variant="premium"><Star aria-hidden />Priority</Badge>
                    )}
                    <span className="truncate">{t.subject}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t.user.email} · {TICKET_TOPIC[t.topic]} · {t._count.messages} message(s) · {t.lastMessageAt.toISOString().slice(0, 16).replace("T", " ")}
                  </span>
                </span>
                <Badge variant={TICKET_STATUS[t.status].variant}>{TICKET_STATUS[t.status].label}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
