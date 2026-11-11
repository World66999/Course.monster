import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { z } from "@/lib/zod";
import { db } from "@/lib/db";
import { getViewer } from "@/server/premium-guard";
import { Section } from "@/components/site/section";
import { Badge } from "@/components/ui/badge";
import { ReplyTicketForm } from "@/components/premium/support-forms";
import { TICKET_STATUS, TICKET_TOPIC } from "@/lib/support-labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Support ticket", robots: { index: false } };
export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(`/premium/support/${id}`)}`);
  if (!z.string().cuid().safeParse(id).success) notFound();

  // Ownership is part of the query: another user's ticket id is a 404, not a 403,
  // so the response doesn't even confirm the ticket exists.
  const ticket = await db.supportTicket.findFirst({
    where: { id, userId: viewer.id },
    select: {
      id: true,
      subject: true,
      topic: true,
      status: true,
      messages: { orderBy: { createdAt: "asc" }, select: { id: true, body: true, fromStaff: true, createdAt: true } },
    },
  });
  if (!ticket) notFound();

  return (
    <Section className="max-w-3xl py-12">
      <Link href="/premium/support" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All tickets
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-heading">{ticket.subject}</h1>
          <p className="text-sm text-muted-foreground">{TICKET_TOPIC[ticket.topic]}</p>
        </div>
        <Badge variant={TICKET_STATUS[ticket.status].variant}>{TICKET_STATUS[ticket.status].label}</Badge>
      </div>

      <ol className="mt-8 space-y-4">
        {ticket.messages.map((m) => (
          <li key={m.id} className={cn("flex flex-col", m.fromStaff ? "items-start" : "items-end")}>
            <span className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
              {m.fromStaff ? (
                <>
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden /> Support team
                </>
              ) : (
                "You"
              )}{" "}
              · {DATE.format(m.createdAt)}
            </span>
            <p
              className={cn(
                "max-w-[90%] rounded-card px-4 py-3 text-sm whitespace-pre-wrap break-words",
                m.fromStaff ? "glass-card" : "bg-primary text-primary-foreground"
              )}
            >
              {m.body}
            </p>
          </li>
        ))}
      </ol>

      <div className="mt-8">
        {ticket.status === "CLOSED" ? (
          <p className="text-sm text-muted-foreground">
            This ticket is closed. <Link href="/premium/support" className="text-primary underline">Open a new one</Link> if you still need help.
          </p>
        ) : (
          <ReplyTicketForm ticketId={ticket.id} />
        )}
      </div>
    </Section>
  );
}
