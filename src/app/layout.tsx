import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
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
        {/* Monetag MultiTag. `beforeInteractive` is what puts this in the
            server-rendered <head>, which is where Monetag's instructions place
            it and what makes it verifiable in the HTML; `afterInteractive`
            would inject it only after hydration. Placement inside the root
            layout is the App Router's supported location for that strategy.
            data-cfasync="false" is carried over from the vendor snippet so
            Cloudflare Rocket Loader leaves the tag alone. */}
        <Script
          src="https://quge5.com/88/tag.min.js"
          data-zone="269101"
          data-cfasync="false"
          strategy="beforeInteractive"
          async
        />
      </body>
    </html>
  );
}
