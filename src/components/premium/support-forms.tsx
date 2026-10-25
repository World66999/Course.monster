"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { closeTicketAction, createTicketAction, replyTicketAction } from "@/server/actions/support";
import { safeAction } from "@/lib/safe-action";
import { SUPPORT_LIMITS } from "@/lib/support-limits";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function NewTicketForm() {
  const router = useRouter();
  const [subject, setSubject] = React.useState("");
  const [topic, setTopic] = React.useState("OTHER_PAYMENT_METHOD");
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await safeAction(() => createTicketAction({ subject, topic, body }), "support-create");
    setBusy(false);
    if (res.ok && "id" in res) {
      toast.success("Ticket sent. We'll reply here — and on Telegram if it's linked.");
      router.push(`/premium/support/${res.id}`);
    } else if (!res.ok) toast.error(res.error);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
        <div className="space-y-1.5">
          <Label htmlFor="t-subject">Subject</Label>
          <Input id="t-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={SUPPORT_LIMITS.subjectMax} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-topic">Topic</Label>
          <Select value={topic} onValueChange={setTopic}>
            <SelectTrigger id="t-topic"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="OTHER_PAYMENT_METHOD">Another payment method</SelectItem>
              <SelectItem value="PAYMENT_PROBLEM">Payment problem</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="t-body">Message</Label>
        <Textarea
          id="t-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={SUPPORT_LIMITS.bodyMax}
          placeholder="For a payment problem, include the order or invoice id from your confirmation, the coin and roughly when you paid."
          required
        />
        <p className="text-xs text-muted-foreground">{body.length} / {SUPPORT_LIMITS.bodyMax}</p>
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
        Send ticket
      </Button>
    </form>
  );
}

export function ReplyTicketForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await safeAction(() => replyTicketAction({ ticketId, body }), "support-reply");
    setBusy(false);
    if (res.ok) {
      setBody("");
      router.refresh();
    } else toast.error(res.error);
  }

  async function close() {
    const res = await safeAction(() => closeTicketAction(ticketId), "support-close");
    if (res.ok) router.refresh();
    else toast.error(res.error);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Label htmlFor="r-body">Reply</Label>
      <Textarea id="r-body" value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={SUPPORT_LIMITS.bodyMax} required />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !body.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
          Send reply
        </Button>
        <Button type="button" variant="ghost" onClick={close}>
          <XCircle className="h-4 w-4" aria-hidden /> Close ticket
        </Button>
      </div>
    </form>
  );
}
