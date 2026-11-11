"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { Bookmark } from "lucide-react";
import { toast } from "@/lib/toast";
import { toggleChannelBookmarkAction } from "@/server/actions/coding-channels";
import { safeAction } from "@/lib/safe-action";
import { cn } from "@/lib/utils";

export function ChannelBookmarkButton({
  channelId,
  initialBookmarked,
}: {
  channelId: string;
  initialBookmarked: boolean;
}) {
  const { data: session } = useSession();
  const [bookmarked, setBookmarked] = React.useState(initialBookmarked);
  const [busy, setBusy] = React.useState(false);

  async function onClick() {
    if (!session?.user) {
      toast.error("Sign in to bookmark this channel.");
      return;
    }
    if (busy) return;
    setBusy(true);
    const next = !bookmarked;
    setBookmarked(next);
    try {
      const result = await safeAction(() => toggleChannelBookmarkAction(channelId), "toggle channel bookmark");
      if (!result.ok) {
        setBookmarked(!next);
        toast.error(result.error);
      } else {
        toast.success(next ? "Bookmarked" : "Bookmark removed");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      aria-pressed={bookmarked}
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        bookmarked ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-foreground hover:bg-muted"
      )}
    >
      <Bookmark className={cn("h-4 w-4", bookmarked && "fill-primary")} aria-hidden />
      {bookmarked ? "Bookmarked" : "Bookmark"}
    </button>
  );
}
