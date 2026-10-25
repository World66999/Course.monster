import { SocialTabs } from "@/components/admin/social/social-tabs";

export default function SocialDownloaderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading">Social downloader</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Website downloads run on a separate worker pool from the Telegram bot, so traffic here can
          never slow the bot down. Submitted links are stored only as a one-way hash, so no URL a
          member pasted is recoverable from this panel.
        </p>
      </div>
      <SocialTabs />
      {children}
    </div>
  );
}
