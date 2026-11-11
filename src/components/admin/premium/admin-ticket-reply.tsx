"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "@/lib/toast";
import { adminReplyTicketAction, adminSetTicketStatusAction } from "@/server/actions/admin-support";
import { safeAction } from "@/lib/safe-action";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

export function AdminTicketReply({ ticketId, status }: { ticketId: string; status: "OPEN" | "ANSWERED" | "CLOSED" }) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function reply(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await safeAction(() => adminReplyTicketAction({ ticketId, body }), "admin-reply");
    setBusy(false);
    if (res.ok) {
      setBody("");
      toast.success("Reply sent");
      router.refresh();
    } else toast.error(res.error);
  }

  async function setStatus(next: "OPEN" | "CLOSED") {
    const res = await safeAction(() => adminSetTicketStatusAction({ ticketId, status: next }), "admin-ticket-status");
    if (res.ok) router.refresh();
    else toast.error(res.error);
  }

  return (
    <form onSubmit={reply} className="space-y-3 rounded-card border border-border bg-card p-5 shadow-soft">
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={4000} placeholder="Write a reply — the user is notified on Telegram if linked." />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !body.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Reply
        </Button>
        {status !== "CLOSED" ? (
          <Button type="button" variant="outline" onClick={() => setStatus("CLOSED")}>Close ticket</Button>
        ) : (
          <Button type="button" variant="outline" onClick={() => setStatus("OPEN")}>Reopen</Button>
        )}
      </div>
    </form>
  );
}
