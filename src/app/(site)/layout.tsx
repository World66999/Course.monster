import { Suspense } from "react";
import { getSiteSettings } from "@/lib/settings";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { ScrollProgress } from "@/components/motion/scroll-progress";
import { TelegramWebAppAuth } from "@/components/premium/telegram-webapp-auth";
import { RevealController } from "@/components/site/reveal-controller";
import { VisitBeacon } from "@/components/site/visit-beacon";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Public site only — the admin panel is a working surface where a
          reading-progress bar would be noise, not information. */}
      <ScrollProgress />
      <TelegramWebAppAuth />
      <RevealController />
      <VisitBeacon />
      <Header settings={settings} />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      {/* Its own boundary (nothing suspends): the footer hydrates in a
          separate short task, after the content above it. */}
      <Suspense fallback={null}>
        <Footer settings={settings} />
      </Suspense>
    </div>
  );
}
