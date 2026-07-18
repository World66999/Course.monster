import { getSiteSettings } from "@/lib/settings";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  return (
    <div className="flex min-h-dvh flex-col">
      <Header settings={settings} />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer settings={settings} />
    </div>
  );
}
