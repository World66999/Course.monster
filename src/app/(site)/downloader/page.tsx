import type { Metadata } from "next";
import { auth } from "@/auth";
import { PageHeader, Section } from "@/components/site/section";
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
      <PageHeader
        eyebrow="Tools"
        title="Social Media Downloader"
        description="Paste a link from YouTube, Facebook, Instagram, TikTok or Pinterest and the file is prepared for you to download."
      />
      <div className="rounded-feature border border-border bg-card p-6 shadow-soft sm:p-8">
        <SocialDownloader signedIn={Boolean(session?.user?.id)} />
      </div>
      {/* Alternative, never a dependency: the downloader above stands alone. */}
      <DownloaderTelegramCta handle={downloaderBotHandle()} url={downloaderBotUrl()} />
    </Section>
  );
}
