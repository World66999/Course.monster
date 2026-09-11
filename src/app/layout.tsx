import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "next-themes";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { getSiteSettings } from "@/lib/settings";
import { absoluteUrl } from "@/lib/utils";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face for headings only. Geist stays the body face: it is a superb UI
// sans but its headline voice is neutral to the point of anonymous, which is
// most of why the old pages read as generic. Jakarta's tighter apertures and
// higher contrast give headings a distinct personality without a second body
// font's readability cost. Weights are pinned to the three actually used so
// this adds ~3 subset files, not a family.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

/**
 * Without an explicit viewport export Next emits only
 * `width=device-width, initial-scale=1`, which has no `viewport-fit`. That
 * matters here because three surfaces already pad themselves with
 * `env(safe-area-inset-bottom)` — the mobile nav drawer, the admin sidebar and
 * the sticky course CTA bar — and `env()` only resolves to real values under
 * `viewport-fit: cover`. Until now those paddings silently computed to 0px and
 * iOS letterboxed the page away from the home indicator, so the site never went
 * edge to edge on a notched iPhone.
 *
 * Turning cover on means the layout viewport spans the whole screen, so in
 * landscape the notch sits over the page's leading edge. The `page-gutter`
 * utility every container now uses takes the larger of the design gutter and
 * the horizontal inset, which is what keeps text clear of it.
 *
 * `maximumScale`/`userScalable` are deliberately left unset: pinch zoom stays
 * available, since disabling it is an accessibility failure.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Colours the browser chrome to match the page instead of leaving a white bar
  // above a dark page. Values are the light/dark `--background` tokens.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6fa" },
    { media: "(prefers-color-scheme: dark)", color: "#08080f" },
  ],
};

export async function generateMetadata(): Promise<Metadata> {  const settings = await getSiteSettings();
  return {
    metadataBase: new URL(absoluteUrl()),
    title: {
      default: settings.seo.defaultTitle,
      template: settings.seo.titleTemplate,
    },
    description: settings.seo.defaultDescription,
    applicationName: settings.siteName,
    openGraph: {
      siteName: settings.siteName,
      type: "website",
      ...(settings.seo.metaImageUrl ? { images: [settings.seo.metaImageUrl] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      ...(settings.seo.twitterHandle ? { site: settings.seo.twitterHandle } : {}),
    },
    ...(settings.faviconUrl ? { icons: { icon: settings.faviconUrl } } : {}),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSiteSettings();
  const gaId = settings.analytics.googleAnalyticsId;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} ${jakarta.variable} antialiased`}>
        {/* Safety net for scripting-disabled visitors.

            Every scroll reveal and the hero headline are server-rendered by
            framer-motion in their `initial` state, which it emits as the inline
            style `opacity:0`. With JS enabled that is corrected within a frame.
            With JS disabled nothing ever corrects it and the page renders
            blank. The attribute substring selector matches exactly those inline
            styles and restores them, and because it lives inside <noscript> it
            has no effect whatsoever on normal visitors. */}
        <noscript>
          <style>{`[style*="opacity:0"]{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        <ThemeProvider
          attribute="class"
          defaultTheme={settings.theme.defaultMode}
          enableSystem
          disableTransitionOnChange
        >
          {/* Deliberately NOT seeding this with a server-fetched session:
              calling auth() here would make every page under this layout
              opt out of static rendering (no PPR configured), regressing
              the whole site to full per-request SSR just to avoid a brief
              client-side loading flash. useSession() fetches on mount instead. */}
          <SessionProvider>
            {children}
            <Toaster richColors position="bottom-right" />
          </SessionProvider>
        </ThemeProvider>
        {gaId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}');`}
            </Script>
          </>
        ) : null}
        {/* Monetag MultiTag.
            `afterInteractive`, deliberately, NOT `beforeInteractive`. Next
            implements beforeInteractive by pushing the script into
            `self.__next_s` and loading it *before hydration* — so React
            interactivity waited on a third-party ad host. Measured against a
            30s stall on quge5.com: hydration completed at 31.0s desktop /
            32.2s mobile, versus 2.0s / 2.2s normally. The page painted quickly
            either way, so it looked loaded while every button and form was
            dead. Outright failures (blocked, 500, 404, DNS) were never the
            problem: they error fast. A merely *slow* response was.
            afterInteractive still loads the tag on every page load, once, with
            the same zone and attributes — it just cannot hold the UI hostage.
            data-cfasync="false" is carried over from the vendor snippet so
            Cloudflare Rocket Loader leaves the tag alone. */}
        <Script
          src="https://quge5.com/88/tag.min.js"
          data-zone="269101"
          data-cfasync="false"
          strategy="afterInteractive"
          async
        />
      </body>
    </html>
  );
}
