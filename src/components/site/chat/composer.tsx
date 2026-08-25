"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Loader2, Send, ImagePlus, X, AtSign } from "lucide-react";
import { toast } from "sonner";
import type { ChatMessageDTO } from "@/lib/chat-shared";
import { createChatMessageAction, setChatDisplayNameAction } from "@/server/actions/chat";
import { safeAction } from "@/lib/safe-action";
import { Button } from "@/components/ui/button";
import { Textarea, Input, FieldError } from "@/components/ui/input";

const MAX_LENGTH = 4_000;

interface MentionMatch {
  id: string;
  label: string;
}

function ChatDisplayNamePrompt({ onSet }: { onSet: (name: string) => void }) {
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const { update } = useSession();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await safeAction(() => setChatDisplayNameAction({ chatDisplayName: value }), "set chat display name");
      if (result.ok) {
        await update({ chatDisplayName: value });
        onSet(value);
      } else {
        setError(result.error);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-2xl border border-dashed border-border bg-muted/30 p-4">
      <p className="text-sm font-medium">Choose a name to chat with</p>
      <p className="text-xs text-muted-foreground">
        This is shown next to your messages instead of your account name. You can change it later.
      </p>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. course_fan92"
          maxLength={24}
          aria-label="Chat display name"
        />
        <Button type="submit" disabled={busy || value.trim().length < 3}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Save
        </Button>
      </div>
      <FieldError message={error} />
    </form>
  );
}

export function Composer({
  replyTo,
  onCancelReply,
  onPosted,
}: {
  replyTo: ChatMessageDTO | null;
  onCancelReply: () => void;
  onPosted: () => void;
}) {
  const { data: session, status } = useSession();
  const [chatDisplayName, setChatDisplayName] = React.useState<string | null | undefined>(
    session?.user?.chatDisplayName
  );
  const [body, setBody] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [image, setImage] = React.useState<{ path: string; thumbPath: string; previewUrl: string } | null>(null);
  const [uploadingImage, setUploadingImage] = React.useState(false);
  const [mentionQuery, setMentionQuery] = React.useState<string | null>(null);
  const [mentionResults, setMentionResults] = React.useState<MentionMatch[]>([]);
  const [mentioned, setMentioned] = React.useState<MentionMatch[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    setChatDisplayName(session?.user?.chatDisplayName);
  }, [session?.user?.chatDisplayName]);

  React.useEffect(() => {
    if (mentionQuery === null) {
      setMentionResults([]);
      return;
    }
    const t = setTimeout(async () => {
      if (!mentionQuery) {
        setMentionResults([]);
        return;
      }
      try {
        const res = await fetch(`/api/chat/mention-search?q=${encodeURIComponent(mentionQuery)}`);
        const data = (await res.json()) as { items: MentionMatch[] };
        setMentionResults(data.items ?? []);
      } catch {
        setMentionResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [mentionQuery]);

  function onBodyChange(value: string) {
    setBody(value);
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    const upToCursor = value.slice(0, cursor);
    const match = /@([a-zA-Z0-9_]{0,24})$/.exec(upToCursor);
    setMentionQuery(match ? match[1] : null);
  }

  function insertMention(user: MentionMatch) {
    const cursor = textareaRef.current?.selectionStart ?? body.length;
    const upToCursor = body.slice(0, cursor);
    const match = /@([a-zA-Z0-9_]{0,24})$/.exec(upToCursor);
    if (!match) return;
    const start = match.index;
    const token = `@[${user.id}] `;
    const next = body.slice(0, start) + token + body.slice(cursor);
    setBody(next);
    setMentionQuery(null);
    setMentioned((prev) => (prev.some((m) => m.id === user.id) ? prev : [...prev, user]));
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingImage(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload/chat-image", { method: "POST", body: form });
      const data = (await res.json()) as { path?: string; thumbPath?: string; error?: string };
      if (!res.ok || !data.path || !data.thumbPath) {
        throw new Error(data.error ?? "Upload failed");
      }
      setImage({ path: data.path, thumbPath: data.thumbPath, previewUrl: data.thumbPath });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingImage(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if ((!body.trim() && !image) || submitting) return;
    setSubmitting(true);
    try {
      const result = await safeAction(
        () =>
          createChatMessageAction({
            parentId: replyTo?.id,
            body,
            imageUrl: image?.path,
            imageThumbUrl: image?.thumbPath,
          }),
        "post chat message"
      );
      if (result.ok) {
        setBody("");
        setImage(null);
        setMentioned([]);
        onCancelReply();
        onPosted();
      } else {
        toast.error(result.error);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") return null;

  if (!session?.user) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-center">
        <p className="text-sm text-muted-foreground">Sign in to send messages.</p>
        <Link href="/login?callbackUrl=/chat" className="text-sm font-medium text-primary hover:underline">
          Sign in
        </Link>
      </div>
    );
  }

  if (!chatDisplayName) {
    return <ChatDisplayNamePrompt onSet={setChatDisplayName} />;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      {replyTo && (
        <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-1.5 text-xs">
          <span className="truncate text-muted-foreground">
            Replying to <span className="font-medium">{replyTo.author.label}</span>
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}

      {mentioned.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {mentioned.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              <AtSign className="h-3 w-3" aria-hidden />
              {m.label}
            </span>
          ))}
        </div>
      )}

      {image && (
        <div className="relative inline-flex">
          <Image src={image.previewUrl} alt="Attached image preview" width={80} height={80} unoptimized className="rounded-xl object-cover" />
          <button
            type="button"
            onClick={() => setImage(null)}
            className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white"
            aria-label="Remove image"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          rows={replyTo ? 2 : 3}
          maxLength={MAX_LENGTH}
          placeholder="Message the community… use @ to mention someone"
          aria-label="Write a message"
        />
        {mentionQuery !== null && mentionResults.length > 0 && (
          <div className="absolute top-full left-0 z-20 mt-1 w-64 overflow-hidden rounded-xl border border-border bg-card shadow-floating">
            {mentionResults.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => insertMention(user)}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <AtSign className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                {user.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={uploadingImage || Boolean(image)}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ImagePlus className="h-4 w-4" aria-hidden />}
            Image
          </Button>
        </div>
        <Button type="submit" size="sm" disabled={submitting || (!body.trim() && !image)}>
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />}
          Send
        </Button>
      </div>
    </form>
  );
}
