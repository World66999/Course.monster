import type { Metadata } from "next";
import { auth } from "@/auth";
import { Section } from "@/components/site/section";
import { SocialDownloader } from "@/components/site/social-downloader";
import { DownloaderTelegramCta } from "@/components/site/downloader-telegram-cta";
import { downloaderBotHandle, downloaderBotUrl } from "@/lib/downloader-bot";

export const metadata: Metadata = {
  title: "Social Media Downloader",
  description:
    "Download publicly available videos from YouTube, Facebook, Instagram, TikTok and Pinterest.",
};
export const dynamic = "force-dynamic";

export default async function DownloaderPage() {
  const session = await auth();
  return (
    <Section className="max-w-3xl py-12 sm:py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Social Media Downloader</h1>
        <p className="mt-2 text-muted-foreground">
          Paste a link from YouTube, Facebook, Instagram, TikTok or Pinterest and the file is
          prepared for you to download.
        </p>
      </div>
      <div className="rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
        <SocialDownloader signedIn={Boolean(session?.user?.id)} />
      </div>
      {/* Alternative, never a dependency: the downloader above stands alone. */}
      <DownloaderTelegramCta handle={downloaderBotHandle()} url={downloaderBotUrl()} />
    </Section>
  );
}
