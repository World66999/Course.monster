import type { Metadata, Viewport } from "next";
import { Inter, Sora, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { SessionProvider } from "next-auth/react";
import { LazyToaster } from "@/components/site/lazy-widgets";
import { getSiteSettings } from "@/lib/settings";
import { absoluteUrl } from "@/lib/utils";
import { bootScript } from "@/lib/boot-script";
import "./globals.css";

// Body face. Inter is built for screens at text sizes, so long course
// descriptions stay readable on the dark surfaces. Variable font: one file
// covers every weight in use.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Used for order ids, code and a few figures, none of them above the fold:
// not preloaded, so it never competes with the two faces that paint the page.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

// Display face for headings only: Sora's wide, geometric capitals carry the
// premium look at hero sizes. Geist Mono stays for figures and code.
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
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
    { media: "(prefers-color-scheme: light)", color: "#f7f6fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0912" },
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
    // Installable-app metadata (see app/manifest.ts). The admin-set favicon
    // still wins for the browser tab; the touch icon is the bundled one.
    appleWebApp: { capable: true, title: settings.siteName, statusBarStyle: "black-translucent" },
    formatDetection: { telephone: false },
    icons: {
      icon: settings.faviconUrl || [
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon.svg", type: "image/svg+xml" },
      ],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSiteSettings();
  const gaId = settings.analytics.googleAnalyticsId;
  const defaultMode = settings.theme.defaultMode;

  return (
    // The class is rendered for a dark default so the boot script normally has
    // nothing to change; `suppressHydrationWarning` covers the visitors whose
    // saved choice differs.
    <html
      lang="en"
      className={defaultMode === "dark" ? "dark" : undefined}
      data-theme-default={defaultMode}
      suppressHydrationWarning
    >
      <body className={`${inter.variable} ${geistMono.variable} ${sora.variable} antialiased`}>
        {/* Theme + performance tier, before anything paints (lib/boot-script.ts). */}
        <script dangerouslySetInnerHTML={{ __html: bootScript(defaultMode) }} />
        {/* Safety net for scripting-disabled visitors: the few places that still
            use framer-motion (auth and admin forms) server-render their
            `initial` state as inline `opacity:0`, which nothing would correct
            without JS. Inside <noscript>, so it never affects anyone else. */}
        <noscript>
          <style>{`[style*="opacity:0"]{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        {/* Deliberately NOT seeding this with a server-fetched session:
            calling auth() here would make every page under this layout
            opt out of static rendering (no PPR configured), regressing
            the whole site to full per-request SSR just to avoid a brief
            client-side loading flash. useSession() fetches on mount instead. */}
        <SessionProvider>
          {children}
          <LazyToaster />
        </SessionProvider>
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
      </body>
    </html>
  );
}
