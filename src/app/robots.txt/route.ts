import { getSiteSettings } from "@/lib/settings";
import { absoluteUrl } from "@/lib/utils";

export const revalidate = 3600;

/** Serves the admin-editable robots.txt with the sitemap URL appended. */
export async function GET() {
  const settings = await getSiteSettings();
  const body = `${settings.robotsTxt.trim()}\n\nSitemap: ${absoluteUrl("/sitemap.xml")}\n`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
