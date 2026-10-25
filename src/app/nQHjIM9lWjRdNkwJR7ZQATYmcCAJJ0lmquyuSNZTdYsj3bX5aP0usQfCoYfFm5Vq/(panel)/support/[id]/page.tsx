import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Star } from "lucide-react";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminPath } from "@/lib/admin-path";
import { isActiveUntil } from "@/lib/premium";
import { TICKET_STATUS, TICKET_TOPIC } from "@/lib/support-labels";
import { Badge } from "@/components/ui/badge";
import { AdminTicketReply } from "@/components/admin/premium/admin-ticket-reply";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Ticket" };
export const dynamic = "force-dynamic";

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().cuid().safeParse(id).success) notFound();
  const ticket = await db.supportTicket.findUnique({
    where: { id },
    select: {
      id: true,
      subject: true,
      topic: true,
      status: true,
      priority: true,
      createdAt: true,
      user: { select: { id: true, email: true, name: true, premiumUntil: true, telegramId: true } },
      messages: { orderBy: { createdAt: "asc" }, select: { id: true, body: true, fromStaff: true, createdAt: true } },
    },
  });
  if (!ticket) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <Link href={adminPath("support")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Inbox
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-heading">{ticket.subject}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href={adminPath(`users/${ticket.user.id}`)} className="text-primary hover:underline">{ticket.user.email}</Link>
            {" · "}{TICKET_TOPIC[ticket.topic]}
            {" · "}{isActiveUntil(ticket.user.premiumUntil) ? "Premium member" : "Free plan"}
            {!ticket.user.telegramId && " · no Telegram linked (reply shows on the site only)"}
          </p>
        </div>
        <div className="flex gap-2">
          {ticket.priority && <Badge variant="premium"><Star aria-hidden />Priority</Badge>}
          <Badge variant={TICKET_STATUS[ticket.status].variant}>{TICKET_STATUS[ticket.status].label}</Badge>
        </div>
      </div>
      <ol className="space-y-3">
        {ticket.messages.map((m) => (
          <li key={m.id} className={cn("rounded-card border p-4 text-sm", m.fromStaff ? "border-primary/30 bg-primary-soft/40" : "border-border bg-card")}>
            <p className="mb-1 text-xs text-muted-foreground">
              {m.fromStaff ? "Support team" : ticket.user.name} · {m.createdAt.toISOString().slice(0, 16).replace("T", " ")}
            </p>
            <p className="whitespace-pre-wrap break-words">{m.body}</p>
          </li>
        ))}
      </ol>
      <AdminTicketReply ticketId={ticket.id} status={ticket.status} />
    </div>
  );
}
