"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Megaphone, Send } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Textarea, Label, FieldHint } from "@/components/ui/input";
import { safeAction } from "@/lib/safe-action";
import { createBroadcastAction } from "@/server/actions/admin-telegram";

const MAX = 3500;

export function BroadcastComposer({ audience, configured }: { audience: number; configured: boolean }) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  async function send() {
    if (sending) return;
    setSending(true);
    try {
      const result = await safeAction(() => createBroadcastAction({ body }));
      if (result.ok) {
        toast.success(`Broadcast queued for ${audience} user${audience === 1 ? "" : "s"}.`);
        setBody("");
        setConfirming(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setSending(false);
    }
  }

  const tooLong = body.length > MAX;
  const empty = body.trim().length === 0;

  return (
    <section className="space-y-3 rounded-card border border-border bg-card p-6">
      <h2 className="flex items-center gap-2 font-semibold"><Megaphone className="h-4 w-4 text-primary" aria-hidden />Broadcast</h2>
      <div className="space-y-1.5">
        <Label htmlFor="broadcast-body">Message</Label>
        <Textarea
          id="broadcast-body"
          rows={5}
          value={body}
          onChange={(e) => { setBody(e.target.value); setConfirming(false); }}
          placeholder="Announcement to send to everyone who uses the bot…"
        />
        <FieldHint>
          {body.length}/{MAX} characters. Delivery is paced to stay within Telegram&apos;s limits, so a
          large audience takes a while. Users who blocked the bot are skipped automatically.
        </FieldHint>
      </div>
      {!confirming ? (
        <Button
          type="button"
          disabled={!configured || empty || tooLong}
          onClick={() => setConfirming(true)}
        >
          <Send className="h-4 w-4" aria-hidden />
          Send to {audience} user{audience === 1 ? "" : "s"}
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-nested border border-warning/40 bg-warning/10 p-3">
          <span className="text-sm">
            Send this to <strong>{audience}</strong> user{audience === 1 ? "" : "s"}? This cannot be undone.
          </span>
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={sending} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={sending} onClick={() => void send()}>
              {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Confirm send
            </Button>
          </div>
        </div>
      )}
      {!configured && (
        <p className="text-sm text-muted-foreground">
          Broadcasting is unavailable until the bot token is configured on the server.
        </p>
      )}
    </section>
  );
}
