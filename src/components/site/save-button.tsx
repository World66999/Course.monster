"use client";

import { Bookmark } from "lucide-react";
import { toggleSaved, useIsSaved, type LibraryInput } from "@/lib/library";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/**
 * Save / unsave a course in this browser (see lib/library.ts). No sign-in.
 *
 * `overlay` is the round button on a course card's artwork; `inline` is the
 * labelled button on the course page. Both are real buttons with a pressed
 * state, at least 44px on touch screens.
 */
export function SaveButton({
  course,
  variant = "overlay",
  className,
}: {
  course: LibraryInput;
  variant?: "overlay" | "inline";
  className?: string;
}) {
  const saved = useIsSaved(course.slug);

  const onClick = (e: React.MouseEvent) => {
    // The card is one big link; this must not follow it.
    e.preventDefault();
    e.stopPropagation();
    const now = toggleSaved(course);
    if (now) toast.success("Saved to this device", { description: "Find it under Saved, no account needed." });
    else toast.message("Removed from Saved");
  };

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        className={cn(
          "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.97]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          saved
            ? "border-primary/40 bg-primary-soft text-primary"
            : "border-border bg-card text-foreground hover:border-primary/40 hover:text-primary",
          className
        )}
      >
        <Bookmark className={cn("h-4 w-4", saved && "fill-current")} aria-hidden />
        {saved ? "Saved" : "Save"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${course.title} from Saved` : `Save ${course.title}`}
      className={cn(
        "tap-target flex h-9 w-9 cursor-pointer items-center justify-center rounded-full shadow-soft transition-[background-color,color,transform] duration-200 active:scale-90",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40",
        saved ? "bg-primary text-primary-foreground" : "bg-black/55 text-white hover:bg-black/75",
        className
      )}
    >
      <Bookmark className={cn("h-4 w-4", saved && "fill-current")} aria-hidden />
    </button>
  );
}
