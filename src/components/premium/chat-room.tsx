"use client";

import * as React from "react";
import { Loader2, SendHorizonal, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { sendPremiumChatMessageAction } from "@/server/actions/premium";
import { safeAction } from "@/lib/safe-action";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { LockedPreview } from "@/components/premium/locked-preview";
import { PremiumNameBadge } from "@/components/premium/crown";
import { cn } from "@/lib/utils";

interface Msg {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  author: { name: string; image: string | null; premium: boolean; staff: boolean };
}
interface Feed {
  me: { id: string; banned: boolean; mutedUntil: string | null; staff: boolean };
  messages: Msg[];
}

const TIME = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const POLL_MS = 5000;

export function PremiumChatRoom({ chatId }: { chatId: string }) {
  const [state, setState] = React.useState<"loading" | "auth" | "locked" | "ready" | "error">("loading");
  const [me, setMe] = React.useState<Feed["me"] | null>(null);
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);
  const latest = React.useRef<string | null>(null);

  const poll = React.useCallback(
    async (full: boolean) => {
      const qs = !full && latest.current ? `?after=${encodeURIComponent(latest.current)}` : "";
      try {
        const res = await fetch(`/api/premium/chats/${chatId}/messages${qs}`, { cache: "no-store" });
        if (res.status === 401) return setState("auth");
        if (res.status === 403) return setState("locked");
        if (!res.ok) return setState((s) => (s === "ready" ? s : "error"));
        const feed = (await res.json()) as Feed;
        setMe(feed.me);
        setMessages((prev) => {
          const merged = full ? feed.messages : [...prev, ...feed.messages.filter((m) => !prev.some((p) => p.id === m.id))];
          latest.current = merged.at(-1)?.createdAt ?? latest.current;
          return merged.slice(-200);
        });
        setState("ready");
      } catch {
        setState((s) => (s === "ready" ? s : "error"));
      }
    },
    [chatId]
  );

  React.useEffect(() => {
    void poll(true);
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void poll(false);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    const res = await safeAction(() => sendPremiumChatMessageAction({ chatId, body }), "premium-chat");
    setSending(false);
    if (res.ok) {
      setText("");
      void poll(false);
    } else toast.error(res.error);
  }

  if (state === "loading") {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }
  if (state === "auth") return <LockedPreview lines={6} cta="Sign in to continue" href={`/login?next=/premium-chats/${chatId}`} />;
  if (state === "locked") return <LockedPreview lines={6} />;
  if (state === "error") return <p className="text-destructive">Couldn&apos;t load this room. Please reload.</p>;

  const muted = me?.mutedUntil ? new Date(me.mutedUntil) : null;
  return (
    <div className="glass-card overflow-hidden rounded-panel">
      <div ref={listRef} className="h-[60dvh] space-y-4 overflow-y-auto p-4 sm:p-5" aria-live="polite">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No messages yet — say hello.</p>}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex flex-col", m.mine ? "items-end" : "items-start")}>
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{m.author.name}</span>
              {m.author.premium && <PremiumNameBadge />}
              {m.author.staff && (
                <span className="inline-flex items-center gap-0.5 text-primary"><ShieldCheck className="h-3 w-3" aria-hidden />Team</span>
              )}
              <time dateTime={m.createdAt}>{TIME.format(new Date(m.createdAt))}</time>
            </div>
            <p
              className={cn(
                "max-w-[85%] rounded-card px-3.5 py-2 text-sm whitespace-pre-wrap break-words",
                m.mine ? "bg-primary text-primary-foreground" : "bg-muted"
              )}
            >
              {m.body}
            </p>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="flex items-end gap-2 border-t border-border p-3">
        {me?.banned ? (
          <p className="p-2 text-sm text-muted-foreground">You can read this room but can&apos;t post in it.</p>
        ) : muted && muted.getTime() > Date.now() ? (
          <p className="p-2 text-sm text-muted-foreground">You&apos;re muted until {TIME.format(muted)}.</p>
        ) : (
          <>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              rows={1}
              placeholder="Write a message…"
              aria-label="Message"
              className="min-h-11 flex-1 resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <Button type="submit" size="icon" aria-label="Send" disabled={sending || !text.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
