"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { BadgeCheck, Bookmark, ExternalLink, Sparkles } from "lucide-react";
import { toast } from "@/lib/toast";
import { toggleChannelBookmarkAction } from "@/server/actions/coding-channels";
import { safeAction } from "@/lib/safe-action";
import { Badge } from "@/components/ui/badge";
import { cardClasses } from "@/components/ui/card";
import { cn, gradientFromString } from "@/lib/utils";
import { UploadPicture } from "@/components/site/upload-picture";

export interface ChannelCardDTO {
  id: string;
  slug: string;
  name: string;
  url: string;
  logo: string | null;
  shortDescription: string | null;
  tags: string[];
  spokenLanguage: string | null;
  skillLevel: string | null;
  featured: boolean;
  verified: boolean;
  bookmarkCount: number;
  bookmarkedByMe: boolean;
}

function ChannelLogo({ name, logo }: { name: string; logo: string | null }) {
  if (logo) {
    return <UploadPicture src={logo} alt={name} sizes="56px" className="h-14 w-14 rounded-nested object-cover" />;
  }
  const { from, to, light } = gradientFromString(name);
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[a-zA-Z0-9]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <div
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-nested"
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      <span className={cn("text-lg font-bold", light ? "text-slate-900/85" : "text-white/90")}>{initials}</span>
    </div>
  );
}

export function ChannelCard({ channel }: { channel: ChannelCardDTO }) {
  const { data: session } = useSession();
  const [bookmarked, setBookmarked] = React.useState(channel.bookmarkedByMe);
  const [busy, setBusy] = React.useState(false);

  async function onBookmark(e: React.MouseEvent) {
    e.preventDefault();
    if (!session?.user) {
      toast.error("Sign in to bookmark channels.");
      return;
    }
    if (busy) return;
    setBusy(true);
    const next = !bookmarked;
    setBookmarked(next);
    try {
      const result = await safeAction(() => toggleChannelBookmarkAction(channel.id), "toggle channel bookmark");
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
      href={`/coding-channels/${channel.slug}`}
      className={cardClasses("gap-3 p-4")}
    >
      <div className="flex items-start gap-3">
        <ChannelLogo name={channel.name} logo={channel.logo} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-semibold text-card-foreground group-hover:text-primary">{channel.name}</h3>
            {channel.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
          </div>
          {channel.shortDescription && (
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{channel.shortDescription}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {channel.featured && (
          <Badge variant="warning">
            <Sparkles className="h-3 w-3" aria-hidden />
            Featured
          </Badge>
        )}
        {channel.skillLevel && <Badge variant="secondary">{formatLevel(channel.skillLevel)}</Badge>}
        {channel.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            #{tag}
          </span>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3">
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          {channel.spokenLanguage || "YouTube"}
        </span>
        <button
          type="button"
          onClick={(e) => void onBookmark(e)}
          aria-pressed={bookmarked}
          aria-label={bookmarked ? "Remove bookmark" : "Bookmark this channel"}
          className={cn(
            // 28x28 as drawn. It also sits inside the card's own Link, so a
            // near-miss on a phone navigated away instead of bookmarking —
            // `tap-target` gives it 44px of reach on a coarse pointer.
            "tap-target inline-flex cursor-pointer items-center justify-center rounded-full border p-1.5 transition-colors",
            bookmarked
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-background text-muted-foreground hover:bg-muted"
          )}
        >
          <Bookmark className={cn("h-3.5 w-3.5", bookmarked && "fill-primary")} aria-hidden />
        </button>
      </div>
    </Link>
  );
}

function formatLevel(level: string): string {
  if (level === "ALL_LEVELS") return "All Levels";
  return level.charAt(0) + level.slice(1).toLowerCase();
}
