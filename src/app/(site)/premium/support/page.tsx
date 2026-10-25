import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LifeBuoy, MessageSquare } from "lucide-react";
import { db } from "@/lib/db";
import { getViewer } from "@/server/premium-guard";
import { Section } from "@/components/site/section";
import { Badge } from "@/components/ui/badge";
import { NewTicketForm } from "@/components/premium/support-forms";
import { TICKET_STATUS, TICKET_TOPIC } from "@/lib/support-labels";

export const metadata: Metadata = { title: "Premium Purchase Support", robots: { index: false } };
export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function SupportPage() {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent("/premium/support")}`);

  // Scoped to the caller — no other user's tickets are ever queried here.
  const tickets = await db.supportTicket.findMany({
    where: { userId: viewer.id },
    orderBy: { lastMessageAt: "desc" },
    take: 50,
    select: { id: true, subject: true, topic: true, status: true, lastMessageAt: true },
  });

  return (
    <Section className="max-w-3xl py-12">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-nested bg-primary-soft text-primary">
          <LifeBuoy className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-heading">Premium Purchase Support</h1>
          <p className="text-sm text-muted-foreground">
            Want to pay another way, or something went wrong with a payment? Tickets are private
            between you and our team.
          </p>
        </div>
      </div>

      <div className="mt-8 glass-card rounded-panel p-5 sm:p-6">
        <h2 className="mb-4 text-subheading">Open a ticket</h2>
        <NewTicketForm />
      </div>

      <h2 className="mt-10 mb-4 text-subheading">Your tickets</h2>
      {tickets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tickets yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                href={`/premium/support/${t.id}`}
                className="surface flex items-center justify-between gap-4 rounded-card p-4 transition-colors hover:border-primary/40"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{t.subject}</span>
                    <span className="text-xs text-muted-foreground">
                      {TICKET_TOPIC[t.topic]} · {DATE.format(t.lastMessageAt)}
                    </span>
                  </span>
                </span>
                <Badge variant={TICKET_STATUS[t.status].variant}>{TICKET_STATUS[t.status].label}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
