"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { formatDistanceToNow } from "date-fns";
import { Bell, MessageSquare, Reply, AtSign, ArrowRightCircle, ShieldCheck } from "lucide-react";
import { markNotificationsReadAction } from "@/server/actions/notifications";
import { safeAction } from "@/lib/safe-action";
import { Dropdown, DropdownTrigger, DropdownContent } from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";
import type { NotificationDTO } from "@/lib/notifications";

const TYPE_ICON: Record<NotificationDTO["type"], React.ComponentType<{ className?: string }>> = {
  REQUEST_COMMENT: MessageSquare,
  REQUEST_REPLY: Reply,
  REQUEST_MENTION: AtSign,
  REQUEST_STATUS_CHANGE: ArrowRightCircle,
  ADMIN_RESPONSE: ShieldCheck,
};

export function NotificationBell() {
  const { data: session } = useSession();
  const [items, setItems] = React.useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loaded, setLoaded] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = (await res.json()) as { items: NotificationDTO[]; unreadCount: number };
      setItems(data.items);
      setUnreadCount(data.unreadCount);
    } finally {
      setLoaded(true);
    }
  }, []);

  // Keyed on the user id, not on `session.user`. That object gets a fresh
  // identity every time next-auth revalidates the session, so depending on it
  // re-ran this effect and refetched notifications for no reason; the id is a
  // primitive and only changes when the signed-in user actually does.
  const userId = session?.user?.id;
  React.useEffect(() => {
    if (userId) void load();
  }, [userId, load]);

  async function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      await load();
      if (unreadCount > 0) {
        setUnreadCount(0);
        setItems((prev) => prev.map((n) => ({ ...n, read: true })));
        // Fire-and-forget, but never an unhandled rejection: a rejected
        // server action (expired session, stale bundle after a deploy) would
        // otherwise surface as an uncaught error from a purely cosmetic
        // "mark as read". The badge is already cleared optimistically and the
        // next load() re-reads the truth, so failing quietly is correct here.
        void safeAction(() => markNotificationsReadAction(), "mark notifications read");
      }
    }
  }

  if (!session?.user) return null;

  return (
    <Dropdown open={open} onOpenChange={onOpenChange}>
      <DropdownTrigger asChild>
        <button
          type="button"
          aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
          className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Bell className="h-4.5 w-4.5" aria-hidden />
          {unreadCount > 0 && (
            <span
              aria-hidden
              className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-destructive ring-2 ring-background"
            />
          )}
        </button>
      </DropdownTrigger>
      <DropdownContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {!loaded ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            items.map((n) => {
              const Icon = TYPE_ICON[n.type];
              const href = n.requestSlug ? `/requests/${n.requestSlug}` : "/requests";
              return (
                <Link
                  key={n.id}
                  href={href}
                  className={cn(
                    "flex items-start gap-3 border-b border-border/60 px-4 py-3 text-sm transition-colors last:border-0 hover:bg-muted/50",
                    !n.read && "bg-primary/5"
                  )}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-foreground/90">{n.message}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </span>
                  </span>
                </Link>
              );
            })
          )}
        </div>
      </DropdownContent>
    </Dropdown>
  );
}
