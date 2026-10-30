"use client";

import * as React from "react";
import { PremiumNameBadge } from "@/components/premium/crown";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Pencil, Reply, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ChatMessageDTO, ChatAuthorDTO } from "@/lib/chat-shared";
import { parseMessageSegments } from "@/lib/chat-shared";
import { toggleChatReactionAction } from "@/server/actions/chat";
import { safeAction } from "@/lib/safe-action";
import { EmojiReactionPicker } from "@/components/site/chat/emoji-reaction-picker";
import { ReportButton } from "@/components/site/report-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function Avatar({ author, size = 36 }: { author: ChatAuthorDTO; size?: number }) {
  if (author.isAdmin) {
    return (
      <span
        aria-hidden
        style={{ width: size, height: size }}
        className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet to-primary text-white shadow-sm shadow-primary/30"
      >
        <ShieldCheck className="h-4 w-4" />
      </span>
    );
  }
  if (author.image) {
    return (
      <Image
        src={author.image}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        unoptimized
      />
    );
  }
  const initials = author.label
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
    >
      {initials || "?"}
    </span>
  );
}

function MessageBody({ body, mentions }: { body: string; mentions: Record<string, ChatAuthorDTO> }) {
  const segments = React.useMemo(() => parseMessageSegments(body), [body]);
  return (
    <p className="mt-0.5 text-sm break-words whitespace-pre-wrap text-foreground/90">
      {segments.map((segment, i) =>
        segment.type === "text" ? (
          <React.Fragment key={i}>{segment.text}</React.Fragment>
        ) : (
          <span key={i} className="font-medium text-primary">
            @{mentions[segment.userId]?.label ?? "unknown user"}
          </span>
        )
      )}
    </p>
  );
}

/**
 * Reply / Edit / Delete under a chat message — 16px-tall text buttons, so
 * `tap-target` extends each one's reach to 44px on a coarse pointer without
 * changing how they look. Mirrors `ACTION_BUTTON` in
 * components/site/comments/comment-item.tsx.
 */
const ACTION_BUTTON = "tap-target inline-flex cursor-pointer items-center gap-1 hover:text-primary";

export function MessageItem({
  message,
  mentions,
  onReply,
  onEdited,
  onDeleted,
  currentUserId,
}: {
  message: ChatMessageDTO;
  mentions: Record<string, ChatAuthorDTO>;
  onReply: (message: ChatMessageDTO) => void;
  onEdited: (id: string, body: string) => Promise<{ ok: boolean; error?: string }>;
  onDeleted: (id: string) => Promise<{ ok: boolean; error?: string }>;
  currentUserId: string | null;
}) {
  const [editing, setEditing] = React.useState(false);
  const [editBody, setEditBody] = React.useState(message.body);
  const [editBusy, setEditBusy] = React.useState(false);
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [reactions, setReactions] = React.useState(message.reactions);
  const [reactBusy, setReactBusy] = React.useState(false);

  async function onSaveEdit() {
    if (editBusy) return;
    setEditBusy(true);
    try {
      const result = await onEdited(message.id, editBody);
      if (result.ok) {
        setEditing(false);
      } else {
        toast.error(result.error);
      }
    } finally {
      setEditBusy(false);
    }
  }

  async function onDeleteClick() {
    if (deleteBusy) return;
    if (!window.confirm("Delete this message?")) return;
    setDeleteBusy(true);
    try {
      const result = await onDeleted(message.id);
      if (result.ok) {
        toast.success("Message deleted");
      } else {
        toast.error(result.error);
      }
    } finally {
      setDeleteBusy(false);
    }
  }

  async function onReact(emoji: string) {
    if (!currentUserId) {
      toast.error("Sign in to react to messages.");
      return;
    }
    if (reactBusy) return;
    setReactBusy(true);
    const existing = reactions.find((r) => r.emoji === emoji);
    const optimistic = existing
      ? existing.reactedByMe
        ? reactions
            .map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, reactedByMe: false } : r))
            .filter((r) => r.count > 0)
        : reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, reactedByMe: true } : r))
      : [...reactions, { emoji, count: 1, reactedByMe: true }];
    setReactions(optimistic);
    try {
      const result = await safeAction(() => toggleChatReactionAction({ messageId: message.id, emoji }), "toggle chat reaction");
      if (!result.ok) {
        setReactions(message.reactions);
        toast.error(result.error);
      }
    } finally {
      setReactBusy(false);
    }
  }

  return (
    <div className="flex gap-3">
      <Avatar author={message.author} />
      <div className="min-w-0 flex-1">
        <div className="rounded-card bg-muted/50 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold">{message.author.label}</span>
            {message.author.isPremium && <PremiumNameBadge />}
            {message.author.isAdmin && (
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-primary uppercase ring-1 ring-primary/15 ring-inset">
                Admin
              </span>
            )}
          </div>

          {message.parentPreview && (
            <div className="mt-1 mb-1.5 rounded-control border-l-2 border-border bg-background/60 px-2.5 py-1 text-xs text-muted-foreground">
              <span className="font-medium">{message.parentPreview.authorLabel}</span>{" "}
              {message.parentPreview.body ? (
                <span className="line-clamp-1">{message.parentPreview.body}</span>
              ) : (
                <span className="italic">sent an image</span>
              )}
            </div>
          )}

          {editing ? (
            <div className="mt-1.5 space-y-2">
              <Textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={2}
                maxLength={4_000}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button type="button" size="sm" disabled={editBusy} onClick={onSaveEdit}>
                  {editBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <>
              {message.body && <MessageBody body={message.body} mentions={mentions} />}
              {message.imageThumbUrl && (
                <>
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="mt-2 block cursor-zoom-in overflow-hidden rounded-nested border border-border"
                  >
                    <Image
                      src={message.imageThumbUrl}
                      alt={`Image shared by ${message.author.label}`}
                      width={220}
                      height={220}
                      loading="lazy"
                      unoptimized
                      className="h-auto max-h-56 w-auto max-w-full object-cover"
                    />
                  </button>
                  <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
                    <DialogContent className="max-w-3xl border-none bg-transparent p-0 shadow-none [&>button]:bg-black/60 [&>button]:text-white [&>button]:hover:bg-black/80">
                      <DialogTitle className="sr-only">Image</DialogTitle>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={message.imageUrl ?? message.imageThumbUrl}
                        alt={`Image shared by ${message.author.label}`}
                        className="max-h-[85dvh] w-full rounded-card object-contain"
                      />
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </>
          )}
        </div>

        {!editing && (
          <div className="mt-1 flex flex-wrap items-center gap-3 px-2 text-xs text-muted-foreground">
            <span suppressHydrationWarning>{formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}</span>
            {message.editedAt && <span>(edited)</span>}
            <button
              type="button"
              onClick={() => onReply(message)}
              className={ACTION_BUTTON}
            >
              <Reply className="h-3.5 w-3.5" aria-hidden />
              Reply
            </button>
            {message.mine ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditBody(message.body);
                    setEditing(true);
                  }}
                  className={ACTION_BUTTON}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void onDeleteClick()}
                  disabled={deleteBusy}
                  className={cn(ACTION_BUTTON, "hover:text-destructive disabled:opacity-60")}
                >
                  {deleteBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  )}
                  Delete
                </button>
              </>
            ) : (
              <ReportButton target={{ chatMessageId: message.id }} />
            )}
          </div>
        )}

        {!editing && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 px-2">
            {reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => void onReact(r.emoji)}
                disabled={reactBusy}
                className={cn(
                  // Grown from `px-1.5 py-0.5` (26px tall) rather than given
                  // `tap-target`: these chips sit shoulder to shoulder, so an
                  // invisible 44px box on each would overlap its neighbours and
                  // fire the wrong reaction — worse than a small target. Real
                  // height plus a slightly wider gap fixes it honestly.
                  "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs transition-colors",
                  r.reactedByMe
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                <span>{r.emoji}</span>
                <span className="tabular-nums">{r.count}</span>
              </button>
            ))}
            <EmojiReactionPicker onPick={(emoji) => void onReact(emoji)} />
          </div>
        )}
      </div>
    </div>
  );
}
