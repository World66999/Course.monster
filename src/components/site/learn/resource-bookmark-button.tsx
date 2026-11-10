"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { Bookmark } from "lucide-react";
import { toast } from "@/lib/toast";
import { toggleResourceBookmarkAction } from "@/server/actions/learning-resources";
import { safeAction } from "@/lib/safe-action";
import { cn } from "@/lib/utils";

export function ResourceBookmarkButton({
  resourceId,
  initialBookmarked,
}: {
  resourceId: string;
  initialBookmarked: boolean;
}) {
  const { data: session } = useSession();
  const [bookmarked, setBookmarked] = React.useState(initialBookmarked);
  const [busy, setBusy] = React.useState(false);

  async function onClick() {
    if (!session?.user) {
      toast.error("Sign in to bookmark this resource.");
      return;
    }
    if (busy) return;
    setBusy(true);
    const next = !bookmarked;
    setBookmarked(next);
    try {
      const result = await safeAction(() => toggleResourceBookmarkAction(resourceId), "toggle resource bookmark");
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
        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        bookmarked ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-foreground hover:bg-muted"
      )}
    >
      <Bookmark className={cn("h-4 w-4", bookmarked && "fill-primary")} aria-hidden />
      {bookmarked ? "Bookmarked" : "Bookmark"}
    </button>
  );
}
