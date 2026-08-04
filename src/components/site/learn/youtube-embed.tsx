"use client";

import * as React from "react";
import { ExternalLink, Play } from "lucide-react";
import { youtubeEmbedUrl, youtubeThumbnailUrl, youtubeWatchUrl, youtubePlaylistUrl } from "@/lib/youtube";
import { cn } from "@/lib/utils";

/**
 * Lite embed: a static thumbnail + play button until the user explicitly
 * clicks, only then mounting a real iframe. Never auto-plays, never loads
 * YouTube's player/cookies on page load — see src/lib/youtube.ts for the
 * embed-rules rationale. A "Watch on YouTube" link is always rendered
 * alongside, not just as a fallback, so a removed/private/embedding-disabled
 * video (which YouTube's own player shows an in-player error for) always
 * has a working way out next to it.
 */
export function YoutubeEmbed({
  videoId,
  playlistId,
  poster,
  title,
  className,
}: {
  /** Empty/absent for a playlist that has no specific starting video. */
  videoId?: string | null;
  playlistId?: string;
  /** Stored thumbnail, preferred over deriving one from the video id. */
  poster?: string | null;
  title: string;
  className?: string;
}) {
  const [playing, setPlaying] = React.useState(false);
  const watchHref = playlistId ? youtubePlaylistUrl(playlistId) : youtubeWatchUrl(videoId ?? "");
  // A playlist has no video id to derive a thumbnail from, so deriving one
  // unconditionally produced `i.ytimg.com/vi//hqdefault.jpg` — a 404, rendered
  // as a broken image on every playlist page while the real thumbnail sat
  // unused in the record. Prefer the stored one; show a placeholder if there is
  // genuinely nothing, rather than an <img> that is known to fail.
  const posterSrc = poster || (videoId ? youtubeThumbnailUrl(videoId) : null);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative aspect-video w-full min-h-[200px] overflow-hidden rounded-xl bg-muted">
        {playing ? (
          <iframe
            src={youtubeEmbedUrl(videoId ?? "", { playlistId })}
            title={title}
            className="h-full w-full"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play ${title}`}
            className="group relative block h-full w-full cursor-pointer"
          >
            {posterSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={posterSrc}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-muted" aria-hidden />
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/35">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-elevated transition-transform group-hover:scale-105">
                <Play className="ml-1 h-7 w-7 fill-primary text-primary" aria-hidden />
              </span>
            </span>
          </button>
        )}
      </div>
      <a
        href={watchHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        Watch on YouTube
      </a>
    </div>
  );
}
