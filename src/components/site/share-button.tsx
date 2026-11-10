"use client";

import { Share2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/**
 * Share a page: the device's own share sheet where there is one (phones, and
 * Telegram's in-app browser on most devices), otherwise copy the link. Falls
 * back again to a prompt-free text selection toast if the clipboard is blocked.
 */
export function ShareButton({ title, path, className }: { title: string; path: string; className?: string }) {
  const onClick = async () => {
    const url = new URL(path, window.location.origin).toString();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err) {
        // Closed the sheet: nothing to do. Anything else: fall through to copy.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.message("Copy this link", { description: url });
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      className={cn(
        "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold transition-[border-color,color,transform] duration-200 hover:border-primary/40 hover:text-primary active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      <Share2 className="h-4 w-4" aria-hidden />
      Share
    </button>
  );
}
