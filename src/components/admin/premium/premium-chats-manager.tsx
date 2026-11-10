"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2, MicOff, Pencil, Plus, RotateCcw, Trash2, Volume2 } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  deletePremiumChatAction,
  deletePremiumChatMessageAction,
  savePremiumChatAction,
  setPremiumChatBanAction,
  setPremiumChatMuteAction,
} from "@/server/actions/admin-premium-content";
import { safeAction } from "@/lib/safe-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Chat {
  id: string;
  title: string;
  description: string;
  category: string;
  kind: "WEB_ROOM" | "TELEGRAM_GROUP";
  telegramChatId: string | null;
  published: boolean;
  order: number;
  messageCount: number;
}
interface Message {
  id: string;
  body: string;
  createdAt: string;
  chat: { title: string };
  user: { id: string; email: string; name: string; role: string; premiumChatBanned: boolean; muted: boolean };
}

export function PremiumChatsManager({ chats, messages }: { chats: Chat[]; messages: Message[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [edit, setEdit] = React.useState<Partial<Chat> | null>(null);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, done?: string) {
    setBusy(true);
    const res = await safeAction(fn);
    setBusy(false);
    if (res.ok) {
      if (done) toast.success(done);
      router.refresh();
      return true;
    }
    toast.error(res.error ?? "Failed");
    return false;
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-card border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Chats</h2>
          <Button size="sm" onClick={() => setEdit({ kind: "WEB_ROOM", published: false, order: chats.length })}>
            <Plus className="h-4 w-4" /> New chat
          </Button>
        </div>
        <ul className="divide-y divide-border">
          {chats.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c.title}</p>
                <p className="text-xs text-muted-foreground">
                  {c.category} · {c.kind === "WEB_ROOM" ? `on-site room, ${c.messageCount} messages` : `Telegram ${c.telegramChatId}`}
                </p>
              </div>
              <Badge variant={c.published ? "success" : "secondary"}>{c.published ? "Published" : "Draft"}</Badge>
              <Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => setEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button size="icon-sm" variant="ghost" aria-label="Delete" disabled={busy} onClick={() => confirm(`Delete “${c.title}” and its messages?`) && run(() => deletePremiumChatAction(c.id), "Chat deleted")}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
          {chats.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No chats yet.</li>}
        </ul>
      </section>

      <section className="space-y-3 rounded-card border border-border bg-card p-5 shadow-soft">
        <h2 className="font-semibold">Moderation — latest messages</h2>
        <ul className="divide-y divide-border">
          {messages.map((m) => (
            <li key={m.id} className="flex flex-wrap items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{m.user.name}</span> ({m.user.email}) in {m.chat.title} ·{" "}
                  {m.createdAt.slice(0, 16).replace("T", " ")}
                  {m.user.premiumChatBanned && <Badge variant="destructive" className="ml-2">banned</Badge>}
                  {m.user.muted && <Badge variant="warning" className="ml-2">muted</Badge>}
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap break-words">{m.body}</p>
              </div>
              <div className="flex gap-1">
                <Button size="icon-sm" variant="ghost" aria-label="Delete message" disabled={busy} onClick={() => run(() => deletePremiumChatMessageAction(m.id), "Message deleted")}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                {m.user.role === "USER" && (
                  <>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={m.user.muted ? "Unmute" : "Mute for 24 hours"}
                      disabled={busy}
                      onClick={() => run(() => setPremiumChatMuteAction({ userId: m.user.id, minutes: m.user.muted ? 0 : 24 * 60 }), m.user.muted ? "Unmuted" : "Muted for 24 hours")}
                    >
                      {m.user.muted ? <Volume2 className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={m.user.premiumChatBanned ? "Unban from chats" : "Ban from chats"}
                      disabled={busy}
                      onClick={() => run(() => setPremiumChatBanAction({ userId: m.user.id, banned: !m.user.premiumChatBanned }), m.user.premiumChatBanned ? "Unbanned" : "Banned from members' chats")}
                    >
                      {m.user.premiumChatBanned ? <RotateCcw className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
          {messages.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No messages.</li>}
        </ul>
      </section>

      <ChatDialog value={edit} onClose={() => setEdit(null)} busy={busy} onSave={(id, input) => run(() => savePremiumChatAction(id, input), "Chat saved")} />
    </div>
  );
}

function ChatDialog({
  value,
  onClose,
  busy,
  onSave,
}: {
  value: Partial<Chat> | null;
  onClose: () => void;
  busy: boolean;
  onSave: (id: string | null, input: unknown) => Promise<boolean>;
}) {
  const [f, setF] = React.useState({ title: "", description: "", category: "", kind: "WEB_ROOM" as Chat["kind"], telegramChatId: "", published: false, order: 0 });
  React.useEffect(() => {
    if (value)
      setF({
        title: value.title ?? "",
        description: value.description ?? "",
        category: value.category ?? "",
        kind: value.kind ?? "WEB_ROOM",
        telegramChatId: value.telegramChatId ?? "",
        published: value.published ?? false,
        order: value.order ?? 0,
      });
  }, [value]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (await onSave(value?.id ?? null, f)) onClose();
  }
  return (
    <Dialog open={value !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle className="text-lg font-semibold">{value?.id ? "Edit chat" : "New chat"}</DialogTitle>
        <form onSubmit={save} className="mt-4 space-y-3">
          <div className="space-y-1"><Label htmlFor="ch-title">Title (public)</Label><Input id="ch-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required maxLength={100} /></div>
          <div className="space-y-1"><Label htmlFor="ch-desc">Description (public)</Label><Textarea id="ch-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} required maxLength={400} /></div>
          <div className="space-y-1"><Label htmlFor="ch-cat">Category (public)</Label><Input id="ch-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} required maxLength={40} placeholder="e.g. Coding, AI, Careers" /></div>
          <div className="space-y-1">
            <Label htmlFor="ch-kind">Type</Label>
            <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v as Chat["kind"] })}>
              <SelectTrigger id="ch-kind"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="WEB_ROOM">On-site room</SelectItem>
                <SelectItem value="TELEGRAM_GROUP">Private Telegram group</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {f.kind === "TELEGRAM_GROUP" && (
            <div className="space-y-1">
              <Label htmlFor="ch-tg">Telegram chat id (never shown publicly)</Label>
              <Input id="ch-tg" value={f.telegramChatId} onChange={(e) => setF({ ...f, telegramChatId: e.target.value })} placeholder="-1001234567890" />
            </div>
          )}
          <label className="flex items-center justify-between gap-2 text-sm font-medium">Published<Switch checked={f.published} onCheckedChange={(v) => setF({ ...f, published: v })} aria-label="Published" /></label>
          <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
