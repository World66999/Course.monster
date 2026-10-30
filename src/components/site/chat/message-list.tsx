"use client";

import { Loader2 } from "lucide-react";
import type { ChatMessageDTO, ChatAuthorDTO } from "@/lib/chat-shared";
import { MessageItem } from "@/components/site/chat/message-item";

export function MessageList({
  messages,
  mentions,
  currentUserId,
  onReply,
  onEdited,
  onDeleted,
  hasOlder,
  loadingOlder,
  onLoadOlder,
  emptyLabel,
}: {
  messages: ChatMessageDTO[];
  mentions: Record<string, ChatAuthorDTO>;
  currentUserId: string | null;
  onReply: (message: ChatMessageDTO) => void;
  onEdited: (id: string, body: string) => Promise<{ ok: boolean; error?: string }>;
  onDeleted: (id: string) => Promise<{ ok: boolean; error?: string }>;
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  emptyLabel: string;
}) {
  if (messages.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-4">
      {hasOlder && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onLoadOlder}
            disabled={loadingOlder}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-60"
          >
            {loadingOlder && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            Load earlier messages
          </button>
        </div>
      )}
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          mentions={mentions}
          onReply={onReply}
          onEdited={onEdited}
          onDeleted={onDeleted}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  );
}
