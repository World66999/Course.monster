"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import type { ChatMessageDTO, ChatAuthorDTO, ChatMessagesResponse } from "@/lib/chat-shared";
import { editChatMessageAction, deleteChatMessageAction } from "@/server/actions/chat";
import { safeAction } from "@/lib/safe-action";
import { MessageList } from "@/components/site/chat/message-list";
import { Composer } from "@/components/site/chat/composer";
import { Input } from "@/components/ui/input";

type OptimisticAction = { type: "update"; id: string; body: string } | { type: "remove"; id: string };

function reduceOptimistic(state: ChatMessageDTO[], action: OptimisticAction): ChatMessageDTO[] {
  switch (action.type) {
    case "update":
      return state.map((m) => (m.id === action.id ? { ...m, body: action.body, editedAt: new Date().toISOString() } : m));
    case "remove":
      return state.filter((m) => m.id !== action.id);
  }
}

export function ChatPanel({
  initial,
  pollIntervalSeconds,
}: {
  initial: ChatMessagesResponse;
  pollIntervalSeconds: number;
}) {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? null;

  const [messages, setMessages] = React.useState<ChatMessageDTO[]>(() => [...initial.items].reverse());
  const [mentions, setMentions] = React.useState<Record<string, ChatAuthorDTO>>(initial.mentions);
  const [olderCursor, setOlderCursor] = React.useState<string | null>(initial.nextCursor);
  const [loadingOlder, setLoadingOlder] = React.useState(false);
  const [replyTo, setReplyTo] = React.useState<ChatMessageDTO | null>(null);
  const [query, setQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<ChatMessageDTO[] | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [, startTransition] = React.useTransition();
  const [optimisticMessages, addOptimistic] = React.useOptimistic(messages, reduceOptimistic);

  const messagesRef = React.useRef(messages);
  React.useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Timestamp of the last successful poll — sent back as `since` so the
  // server can report ids of already-fetched messages that an admin hid or
  // deleted in the meantime (a plain `after` cursor only ever adds new
  // messages, never removes ones already rendered).
  //
  // Always the value the *server* reported, never `new Date()` here. `since` is
  // compared server-side against `ChatMessage.updatedAt`; seeding or advancing
  // it from the browser clock meant any device running fast reported a `since`
  // in the server's future, so `updatedAt > since` matched nothing and hidden
  // messages stayed on screen until a reload. Device clocks are routinely off
  // by minutes and nothing here can detect that, so the browser's clock is
  // simply never one end of the comparison.
  const sinceRef = React.useRef(initial.serverTime);

  function applyRemovedIds(ids?: string[]) {
    if (!ids || ids.length === 0) return;
    const removed = new Set(ids);
    setMessages((prev) => prev.filter((m) => !removed.has(m.id)));
    setReplyTo((prev) => (prev && removed.has(prev.id) ? null : prev));
  }

  const bottomRef = React.useRef<HTMLDivElement>(null);

  function mergeMentions(incoming: Record<string, ChatAuthorDTO>) {
    if (Object.keys(incoming).length === 0) return;
    setMentions((prev) => ({ ...prev, ...incoming }));
  }

  // Poll for new messages while the tab is visible; pause when hidden and
  // resume immediately on refocus. Exponential backoff on fetch errors,
  // reset on the next success — never hammers the API if something's down.
  React.useEffect(() => {
    if (query.trim()) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let backoffMs = pollIntervalSeconds * 1000;

    async function poll() {
      if (document.hidden) {
        timer = setTimeout(poll, pollIntervalSeconds * 1000);
        return;
      }
      try {
        const last = messagesRef.current[messagesRef.current.length - 1];
        const qs = new URLSearchParams();
        if (last) qs.set("after", last.id);
        qs.set("since", sinceRef.current);
        const res = await fetch(`/api/chat/messages?${qs.toString()}`);
        if (!res.ok) throw new Error("poll failed");
        const data = (await res.json()) as ChatMessagesResponse;
        if (!cancelled) {
          if (data.items.length > 0) {
            setMessages((prev) => [...prev, ...data.items]);
            mergeMentions(data.mentions);
          }
          applyRemovedIds(data.removedIds);
          sinceRef.current = data.serverTime;
        }
        backoffMs = pollIntervalSeconds * 1000;
      } catch {
        backoffMs = Math.min(backoffMs * 2, 60_000);
      }
      if (!cancelled) timer = setTimeout(poll, backoffMs);
    }

    timer = setTimeout(poll, pollIntervalSeconds * 1000);

    function onVisibility() {
      if (!document.hidden) {
        clearTimeout(timer);
        timer = setTimeout(poll, 250);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [query, pollIntervalSeconds]);

  // Debounced search — a distinct mode, not merged with the live feed, so
  // polling and search results never interleave confusingly.
  React.useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ q: trimmed });
        const res = await fetch(`/api/chat/messages?${qs.toString()}`);
        const data = (await res.json()) as ChatMessagesResponse;
        setSearchResults([...data.items].reverse());
        mergeMentions(data.mentions);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  async function loadOlder() {
    if (!olderCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const qs = new URLSearchParams({ before: olderCursor });
      const res = await fetch(`/api/chat/messages?${qs.toString()}`);
      const data = (await res.json()) as ChatMessagesResponse;
      setMessages((prev) => [...[...data.items].reverse(), ...prev]);
      mergeMentions(data.mentions);
      setOlderCursor(data.nextCursor);
    } finally {
      setLoadingOlder(false);
    }
  }

  function onPosted() {
    setReplyTo(null);
    // Fetch immediately rather than waiting for the next poll tick, so the
    // sender sees their own message appear without delay.
    void (async () => {
      const last = messagesRef.current[messagesRef.current.length - 1];
      const qs = new URLSearchParams();
      if (last) qs.set("after", last.id);
      qs.set("since", sinceRef.current);
      const res = await fetch(`/api/chat/messages?${qs.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as ChatMessagesResponse;
      if (data.items.length > 0) {
        setMessages((prev) => [...prev, ...data.items]);
        mergeMentions(data.mentions);
      }
      applyRemovedIds(data.removedIds);
      sinceRef.current = data.serverTime;
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    })();
  }

  function submitEditMessage(id: string, body: string): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      startTransition(async () => {
        addOptimistic({ type: "update", id, body });
        const result = await safeAction(() => editChatMessageAction(id, body), "edit chat message");
        if (!result.ok) {
          resolve({ ok: false, error: result.error });
          return;
        }
        if (result.message) {
          if (result.message.status === "VISIBLE") {
            const patch = (m: ChatMessageDTO) =>
              m.id === id ? { ...m, body: result.message!.body, editedAt: result.message!.editedAt } : m;
            setMessages((prev) => prev.map(patch));
            setSearchResults((prev) => (prev ? prev.map(patch) : prev));
          } else {
            setMessages((prev) => prev.filter((m) => m.id !== id));
            setSearchResults((prev) => (prev ? prev.filter((m) => m.id !== id) : prev));
            toast.info("Your edit was flagged and is pending review.");
          }
        }
        resolve({ ok: true });
      });
    });
  }

  function submitDeleteMessage(id: string): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      startTransition(async () => {
        addOptimistic({ type: "remove", id });
        const result = await safeAction(() => deleteChatMessageAction(id), "delete chat message");
        if (!result.ok) {
          resolve({ ok: false, error: result.error });
          return;
        }
        setMessages((prev) => prev.filter((m) => m.id !== id));
        setSearchResults((prev) => (prev ? prev.filter((m) => m.id !== id) : prev));
        resolve({ ok: true });
      });
    });
  }

  const displayed = searchResults ?? optimisticMessages;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chat…"
          className="pl-9"
          aria-label="Search chat"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {searching ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : (
        <MessageList
          messages={displayed}
          mentions={mentions}
          currentUserId={currentUserId}
          onReply={setReplyTo}
          onEdited={submitEditMessage}
          onDeleted={submitDeleteMessage}
          hasOlder={!searchResults && Boolean(olderCursor)}
          loadingOlder={loadingOlder}
          onLoadOlder={loadOlder}
          emptyLabel={searchResults ? "No messages match your search." : "No messages yet — be the first to say hello."}
        />
      )}

      <div ref={bottomRef} />

      <div className="sticky bottom-4 rounded-2xl border border-border bg-card/95 p-3 shadow-elevated backdrop-blur">
        <Composer replyTo={replyTo} onCancelReply={() => setReplyTo(null)} onPosted={onPosted} />
      </div>
    </div>
  );
}
