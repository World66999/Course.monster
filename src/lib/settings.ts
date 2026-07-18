import "server-only";
import { unstable_cache, revalidateTag, revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  SETTINGS_KEY,
  defaultSiteSettings,
  siteSettingsSchema,
  type SiteSettings,
} from "@/lib/settings-schema";

export const SETTINGS_CACHE_TAG = "site-settings";

async function loadSettings(): Promise<SiteSettings> {
  const row = await db.setting.findUnique({ where: { key: SETTINGS_KEY } });
  if (!row) return defaultSiteSettings;
  const parsed = siteSettingsSchema.safeParse(row.value);
  if (!parsed.success) {
    console.error("[settings] stored settings failed validation, using defaults", parsed.error.flatten());
    return defaultSiteSettings;
  }
  return parsed.data;
}

export const getSiteSettings = unstable_cache(loadSettings, [SETTINGS_CACHE_TAG], {
  tags: [SETTINGS_CACHE_TAG],
  revalidate: 300,
});

export async function saveSiteSettings(input: unknown): Promise<SiteSettings> {
  const settings = siteSettingsSchema.parse(input);
  await db.setting.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: settings },
    update: { value: settings },
  });
  revalidateTag(SETTINGS_CACHE_TAG);
  revalidatePath("/", "layout");
  return settings;
}
