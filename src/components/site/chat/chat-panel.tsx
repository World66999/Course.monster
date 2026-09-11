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
import { useChatStream } from "@/hooks/use-chat-stream";

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
}: {
 initial: ChatMessagesResponse;
}) {
 const { data: session } = useSession();
 const currentUserId = session?.user?.id ?? null;

 // SSE stream replaces polling — one DB query per tick regardless of open tabs
 const { messages, setMessages } = useChatStream(initial.items, initial.serverTime);
 const [mentions, setMentions] = React.useState<Record<string, ChatAuthorDTO>>(initial.mentions);
 const [olderCursor, setOlderCursor] = React.useState<string | null>(initial.nextCursor);
 const [loadingOlder, setLoadingOlder] = React.useState(false);
 const [replyTo, setReplyTo] = React.useState<ChatMessageDTO | null>(null);
 const [query, setQuery] = React.useState("");
 const [searchResults, setSearchResults] = React.useState<ChatMessageDTO[] | null>(null);
 const [searching, setSearching] = React.useState(false);
 const [, startTransition] = React.useTransition();
 const [optimisticMessages, addOptimistic] = React.useOptimistic(messages, reduceOptimistic);

 const mergeMentions = React.useCallback((incoming: Record<string, ChatAuthorDTO>) => {
 if (Object.keys(incoming).length === 0) return;
 setMentions((prev) => ({ ...prev, ...incoming }));
 }, []);

 const bottomRef = React.useRef<HTMLDivElement>(null);

 // Debounced search — distinct mode, not merged with the live feed
 React.useEffect(() => {
 const trimmed = query.trim();
 if (!trimmed) {
 setSearchResults(null);
 setSearching(false);
 return;
 }
 setSearching(true);
 let cancelled = false;
 const t = setTimeout(async () => {
 try {
 const qs = new URLSearchParams({ q: trimmed });
 const res = await fetch(`/api/chat/messages?${qs.toString()}`);
 if (!res.ok) throw new Error("search failed");
 const data = (await res.json()) as ChatMessagesResponse;
 if (cancelled) return;
 setSearchResults([...data.items].reverse());
 mergeMentions(data.mentions);
 } catch {
 if (!cancelled) setSearchResults((prev) => prev ?? []);
 } finally {
 if (!cancelled) setSearching(false);
 }
 }, 350);
 return () => {
 cancelled = true;
 clearTimeout(t);
 };
 }, [query, mergeMentions]);

 async function loadOlderMessages() {
 if (!olderCursor || loadingOlder) return;
 setLoadingOlder(true);
 try {
 const qs = new URLSearchParams({ before: olderCursor });
 const res = await fetch(`/api/chat/messages?${qs.toString()}`);
 const data = (await res.json()) as ChatMessagesResponse;
 setMessages((prev) => [...data.items.reverse(), ...prev]);
 mergeMentions(data.mentions);
 setOlderCursor(data.nextCursor);
 } finally {
 setLoadingOlder(false);
 }
 }

 function onPosted() {
 setReplyTo(null);
 // SSE will pick up the new message on its next 2s cycle — no extra fetch needed
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
 onLoadOlder={loadOlderMessages}
 emptyLabel={searchResults ? "No messages match your search." : "No messages yet — be the first to say hello."}
 />
 )}

 <div ref={bottomRef} />

 <div className="sticky bottom-4 rounded-card border border-border bg-card/95 p-3 shadow-elevated backdrop-blur">
 <Composer replyTo={replyTo} onCancelReply={() => setReplyTo(null)} onPosted={onPosted} />
 </div>
 </div>
 );
}
