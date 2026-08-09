"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Bookmark, Clock, ListVideo, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { toggleResourceBookmarkAction } from "@/server/actions/learning-resources";
import { youtubeThumbnailUrl } from "@/lib/youtube";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ResourceCardDTO {
  id: string;
  slug: string;
  title: string;
  url: string;
  videoId: string | null;
  playlistId: string | null;
  thumbnail: string | null;
  resourceType: "VIDEO" | "PLAYLIST";
  creatorName: string | null;
  tags: string[];
  skillLevel: string | null;
  durationMinutes: number | null;
  featured: boolean;
  bookmarkCount: number;
  bookmarkedByMe: boolean;
  category: { name: string; slug: string } | null;
}

export function ResourceCard({ resource }: { resource: ResourceCardDTO }) {
  const { data: session } = useSession();
  const [bookmarked, setBookmarked] = React.useState(resource.bookmarkedByMe);
  const [busy, setBusy] = React.useState(false);

  const thumb = resource.thumbnail || (resource.videoId ? youtubeThumbnailUrl(resource.videoId) : null);

  async function onBookmark(e: React.MouseEvent) {
    e.preventDefault();
    if (!session?.user) {
      toast.error("Sign in to bookmark resources.");
      return;
    }
    if (busy) return;
    setBusy(true);
    const next = !bookmarked;
    setBookmarked(next);
    try {
      const result = await toggleResourceBookmarkAction(resource.id);
      if (!result.ok) {
        setBookmarked(!next);
        toast.error(result.error);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Link
      href={`/learn/${resource.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-elevated"
    >
      <div className="relative aspect-video overflow-hidden bg-muted">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={resource.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <PlayCircle className="h-10 w-10" aria-hidden />
          </div>
        )}
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-xs font-medium text-white backdrop-blur">
          {resource.resourceType === "PLAYLIST" ? (
            <>
              <ListVideo className="h-3 w-3" aria-hidden /> PLAYLIST
            </>
          ) : (
            <>
              <PlayCircle className="h-3 w-3" aria-hidden /> VIDEO
            </>
          )}
        </span>
        {resource.durationMinutes && (
          <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white backdrop-blur">
            <Clock className="h-3 w-3" aria-hidden />
            {resource.durationMinutes}m
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 leading-snug font-semibold text-card-foreground group-hover:text-primary">
          {resource.title}
        </h3>
        {resource.creatorName && <p className="text-sm text-muted-foreground">{resource.creatorName}</p>}

        <div className="flex flex-wrap items-center gap-1.5">
          {resource.featured && <Badge variant="warning">Featured</Badge>}
          {resource.category && <Badge variant="secondary">{resource.category.name}</Badge>}
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-3">
          <span className="text-xs text-muted-foreground">
            {resource.tags.slice(0, 2).map((t) => `#${t}`).join(" ")}
          </span>
          <button
            type="button"
            onClick={(e) => void onBookmark(e)}
            aria-pressed={bookmarked}
            aria-label={bookmarked ? "Remove bookmark" : "Bookmark this resource"}
            className={cn(
              "inline-flex cursor-pointer items-center justify-center rounded-full border p-1.5 transition-colors",
              bookmarked
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            )}
          >
            <Bookmark className={cn("h-3.5 w-3.5", bookmarked && "fill-primary")} aria-hidden />
          </button>
        </div>
      </div>
    </Link>
  );
}
