import type { MetadataRoute } from "next";
import { getSiteSettings } from "@/lib/settings";

/**
 * Web app manifest: makes the site installable ("Add to Home Screen") and
 * gives a future app wrapper its name, colours and icons. No service worker
 * is registered on purpose: nothing is cached offline, so the unlock and
 * payment flows always talk to the live server.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getSiteSettings();
  return {
    id: "/",
    name: settings.siteName,
    short_name: settings.siteName.length > 12 ? settings.siteName.split(/\s+/)[0]! : settings.siteName,
    description: settings.seo.defaultDescription,
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "any",
    lang: "en",
    dir: "ltr",
    categories: ["education"],
    background_color: "#0a0912",
    theme_color: "#0a0912",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Browse courses", url: "/courses", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Saved courses", url: "/saved", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Premium", url: "/premium", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
