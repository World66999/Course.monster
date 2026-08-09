import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import {
  BRANDING_KEY,
  brandingSchema,
  defaultBranding,
  type Branding,
} from "@/lib/telegram/branding-schema";

/**
 * Persistence for the bot's icons / labels / button styles.
 *
 * Reuses the existing `Setting` key-value table and the same
 * `unstable_cache` + tag invalidation pattern as site settings, so there is no
 * second configuration system. A single JSON blob under one key mirrors how
 * Bot5 stores its `icons` / `buttons` / `btn_style` settings rows, but as one
 * atomic value so a save can never leave the three half-applied.
 *
 * Failure policy, in line with the rest of the app: a missing or corrupt blob
 * logs and returns defaults rather than throwing, so a bad configuration can
 * never take the bot down — the worst case is that it looks stock.
 */

export const BRANDING_CACHE_TAG = "telegram-branding";

async function loadBranding(): Promise<Branding> {
  try {
    const row = await db.setting.findUnique({ where: { key: BRANDING_KEY } });
    if (!row) return defaultBranding;
    const parsed = brandingSchema.safeParse(row.value);
    if (!parsed.success) {
      console.error("[telegram] stored branding failed validation, using defaults", parsed.error.flatten());
      return defaultBranding;
    }
    return parsed.data;
  } catch (err) {
    // A database blip must degrade the bot's *appearance*, never its function.
    console.error("[telegram] failed to load branding, using defaults:", err);
    return defaultBranding;
  }
}

/**
 * Cached read. The 60s ceiling matters because a deploy runs two slots and the
 * broadcast pump is a separate process: an explicit `revalidateTag` covers the
 * slot that handled the save, and the TTL bounds how long any other process can
 * serve a stale value.
 */
export const getBranding = unstable_cache(loadBranding, [BRANDING_CACHE_TAG], {
  tags: [BRANDING_CACHE_TAG],
  revalidate: 60,
});

/** Uncached read — used by writers that must not act on a stale snapshot. */
export const readBrandingFresh = loadBranding;

export async function saveBranding(next: Branding): Promise<Branding> {
  const value = brandingSchema.parse(next);
  await db.setting.upsert({
    where: { key: BRANDING_KEY },
    create: { key: BRANDING_KEY, value },
    update: { value },
  });
  revalidateTag(BRANDING_CACHE_TAG);
  return value;
}
