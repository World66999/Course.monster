import { Send } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";

/**
 * "Prefer Telegram?" — the downloader bot offered as an alternative.
 *
 * Purely additive: the website downloader above it works on its own and never
 * depends on Telegram being reachable. Nobody is redirected away from a working
 * download; this is a choice, not a fallback.
 *
 * The identity comes from `downloaderBotUsername()` so the CourseVault bot can
 * never end up here by mistake — they are different bots with different jobs.
 */
export function DownloaderTelegramCta({
  handle,
  url,
}: {
  handle: string;
  url: string;
}) {
  return (
    <div className="mt-6 rounded-feature border border-border bg-card p-6 shadow-soft sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-nested bg-gradient-to-br from-violet to-primary text-white shadow-sm shadow-primary/30">
            <Send className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold">Prefer Telegram?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The same downloader is available as a Telegram bot — send it a link and it replies
              with the file. Supports YouTube, Facebook, Instagram, TikTok and Pinterest.
            </p>
            <p className="mt-2 font-mono text-sm break-all">{handle}</p>
          </div>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          // `buttonClasses("primary")` rather than a hand-rolled copy of it. The
          // copy was 36px tall (px-4 py-2) where the shared `md` size is 40px, so
          // this CTA was both under the touch minimum and visibly shorter than
          // every other primary button on the site.
          className={buttonClasses("primary", "md", "shrink-0")}
        >
          <Send className="h-4 w-4" aria-hidden />
          Open in Telegram
        </a>
      </div>
    </div>
  );
}
