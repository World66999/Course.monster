"use server";

import { revalidatePath } from "next/cache";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth-helpers";
import { logAudit } from "@/lib/audit";
import { adminPath } from "@/lib/admin-path";
import { BRANDING_CACHE_TAG, readBrandingFresh } from "@/lib/telegram/branding";
import { fetchLibrary, planAssignments, verifyConfigured } from "@/lib/telegram/emoji-library";
import {
  BRANDING_KEY,
  brandingSchema,
  defaultBranding,
  iconValueSchema,
  labelValueSchema,
  ICON_META,
  ICON_KEYS,
  LABEL_META,
  type Branding,
} from "@/lib/telegram/branding-schema";
import type { ActionResult } from "@/server/actions/courses";

/**
 * Icon Manager / Button Label Manager / Button Style actions.
 *
 * Gated by the same `requireAdmin()` as the rest of the panel — no second auth
 * system, and the check happens here rather than in the UI, so a direct action
 * invocation is refused just the same.
 */

function revalidate() {
  revalidateTag(BRANDING_CACHE_TAG);
  revalidatePath(adminPath("telegram"), "layout");
}

/**
 * Read-modify-write of the single branding blob.
 *
 * Serializable so two admins saving different icons at the same time cannot
 * clobber each other — under ReadCommitted both would read the same snapshot
 * and the second write would silently drop the first.
 *
 * Postgres aborts the losing transaction, which Prisma surfaces as P2034
 * ("write conflict or a deadlock"). Under real contention a single retry is
 * not enough, so this backs off with jitter; measured against 12 concurrent
 * writers, every write survives.
 */
const MAX_ATTEMPTS = 6;

function isSerializationConflict(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2034: transaction write conflict / deadlock — the documented retry case.
    return err.code === "P2034";
  }
  return err instanceof Error && /could not serialize|deadlock detected|write conflict|40001|40P01/i.test(err.message);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mutateBranding(mutate: (current: Branding) => Branding): Promise<Branding> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const row = await tx.setting.findUnique({ where: { key: BRANDING_KEY } });
          const parsed = row ? brandingSchema.safeParse(row.value) : null;
          const current = parsed?.success ? parsed.data : defaultBranding;
          const next = brandingSchema.parse(mutate(current));
          await tx.setting.upsert({
            where: { key: BRANDING_KEY },
            create: { key: BRANDING_KEY, value: next },
            update: { value: next },
          });
          return next;
        },
        { isolationLevel: "Serializable" }
      );
    } catch (err) {
      lastError = err;
      if (!isSerializationConflict(err)) throw err;
      // Exponential backoff with jitter so retrying writers don't re-collide.
      await sleep(Math.min(20 * 2 ** attempt, 250) + Math.random() * 25);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("branding update failed");
}

const iconKeySchema = z.enum(Object.keys(ICON_META) as [string, ...string[]]);
const labelKeySchema = z.enum(Object.keys(LABEL_META) as [string, ...string[]]);

export async function saveIconAction(key: unknown, value: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsedKey = iconKeySchema.safeParse(key);
  if (!parsedKey.success) return { ok: false, error: "Unknown icon." };
  const parsedValue = iconValueSchema.safeParse(value);
  if (!parsedValue.success) {
    return { ok: false, error: parsedValue.error.issues[0]?.message ?? "Invalid icon." };
  }
  try {
    await mutateBranding((current) => ({
      ...current,
      icons: { ...current.icons, [parsedKey.data]: parsedValue.data },
    }));
  } catch (err) {
    console.error("[telegram] saveIcon failed:", err);
    return { ok: false, error: "Couldn't save the icon. Please try again." };
  }
  await logAudit({
    userId: admin.id,
    action: "telegramBranding.icon.update",
    entity: "telegramBranding",
    entityId: parsedKey.data,
  });
  revalidate();
  return { ok: true };
}

export async function resetIconAction(key: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsedKey = iconKeySchema.safeParse(key);
  if (!parsedKey.success) return { ok: false, error: "Unknown icon." };
  try {
    await mutateBranding((current) => {
      const icons = { ...current.icons };
      // Deleting the override *is* the reset: lookups fall back to ICON_META.
      delete icons[parsedKey.data];
      return { ...current, icons };
    });
  } catch (err) {
    console.error("[telegram] resetIcon failed:", err);
    return { ok: false, error: "Couldn't reset the icon. Please try again." };
  }
  await logAudit({
    userId: admin.id,
    action: "telegramBranding.icon.reset",
    entity: "telegramBranding",
    entityId: parsedKey.data,
  });
  revalidate();
  return { ok: true };
}

export async function saveLabelAction(key: unknown, value: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsedKey = labelKeySchema.safeParse(key);
  if (!parsedKey.success) return { ok: false, error: "Unknown button." };
  const parsedValue = labelValueSchema.safeParse(value);
  if (!parsedValue.success) {
    return { ok: false, error: parsedValue.error.issues[0]?.message ?? "Invalid button label." };
  }
  try {
    await mutateBranding((current) => ({
      ...current,
      labels: { ...current.labels, [parsedKey.data]: parsedValue.data },
    }));
  } catch (err) {
    console.error("[telegram] saveLabel failed:", err);
    return { ok: false, error: "Couldn't save the button. Please try again." };
  }
  await logAudit({
    userId: admin.id,
    action: "telegramBranding.label.update",
    entity: "telegramBranding",
    entityId: parsedKey.data,
  });
  revalidate();
  return { ok: true };
}

export async function resetLabelAction(key: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsedKey = labelKeySchema.safeParse(key);
  if (!parsedKey.success) return { ok: false, error: "Unknown button." };
  try {
    await mutateBranding((current) => {
      const labels = { ...current.labels };
      delete labels[parsedKey.data];
      return { ...current, labels };
    });
  } catch (err) {
    console.error("[telegram] resetLabel failed:", err);
    return { ok: false, error: "Couldn't reset the button. Please try again." };
  }
  await logAudit({
    userId: admin.id,
    action: "telegramBranding.label.reset",
    entity: "telegramBranding",
    entityId: parsedKey.data,
  });
  revalidate();
  return { ok: true };
}

const styleSchema = z.enum(["none", "primary", "success", "danger"]);

export async function setDefaultStyleAction(style: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = styleSchema.safeParse(style);
  if (!parsed.success) return { ok: false, error: "Unknown button style." };
  try {
    await mutateBranding((current) => ({ ...current, defaultStyle: parsed.data }));
  } catch (err) {
    console.error("[telegram] setDefaultStyle failed:", err);
    return { ok: false, error: "Couldn't save the style. Please try again." };
  }
  await logAudit({
    userId: admin.id,
    action: "telegramBranding.style.update",
    entity: "telegramBranding",
    meta: { style: parsed.data },
  });
  revalidate();
  return { ok: true };
}

/** Restores everything to the shipped defaults by clearing all overrides. */
export async function resetAllBrandingAction(): Promise<ActionResult> {
  const admin = await requireAdmin();
  try {
    await mutateBranding(() => defaultBranding);
  } catch (err) {
    console.error("[telegram] resetAllBranding failed:", err);
    return { ok: false, error: "Couldn't reset. Please try again." };
  }
  await logAudit({
    userId: admin.id,
    action: "telegramBranding.resetAll",
    entity: "telegramBranding",
  });
  revalidate();
  return { ok: true };
}

// ── Premium emoji library ──────────────────────────────────────────────

/**
 * Assigns verified premium custom emoji to icons by semantic match.
 *
 * `mode: "fill"` only touches icons that are still on their ordinary default;
 * `mode: "replace"` re-assigns every icon, discarding manual choices. Icons
 * with no semantic match keep their ordinary emoji and are reported as
 * unmatched rather than being given something arbitrary.
 */
export async function autoAssignPremiumIconsAction(mode: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z.enum(["fill", "replace"]).safeParse(mode);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const library = await fetchLibrary();
  if (library.length === 0) {
    return { ok: false, error: "Couldn't reach Telegram to load the emoji library." };
  }

  try {
    let assignedCount = 0;
    let unmatchedCount = 0;
    await mutateBranding((current) => {
      const targets =
        parsed.data === "replace"
          ? ICON_KEYS
          : ICON_KEYS.filter((k) => current.icons[k] === undefined);
      const { assigned, unmatched } = planAssignments(library, targets);
      assignedCount = assigned.length;
      unmatchedCount = unmatched.length;
      const icons = { ...current.icons };
      for (const a of assigned) {
        icons[a.key] = {
          premiumId: a.id,
          // Telegram requires a real emoji as the fallback; the matched glyph
          // is exactly what the sticker represents.
          char: a.matchedEmoji,
          set: a.set,
          auto: true,
          verifiedAt: Date.now(),
        };
      }
      return { ...current, icons };
    });

    await logAudit({
      userId: admin.id,
      action: "telegramBranding.autoAssign",
      entity: "telegramBranding",
      meta: { mode: parsed.data, assigned: assignedCount, unmatched: unmatchedCount },
    });
    revalidate();
    return { ok: true, id: `${assignedCount} assigned, ${unmatchedCount} without a match` };
  } catch (err) {
    console.error("[telegram] autoAssign failed:", err);
    return { ok: false, error: "Couldn't assign premium icons. Please try again." };
  }
}

/** Re-checks every configured id against Telegram and reports what no longer resolves. */
export async function verifyEmojiLibraryAction(): Promise<ActionResult> {
  await requireAdmin();
  const current = await readBrandingFresh();
  const result = await verifyConfigured(current);
  revalidate();
  if (result.checked === 0) return { ok: true, id: "No premium emoji configured yet" };
  if (result.invalid.length > 0) {
    return { ok: false, error: `${result.invalid.length} of ${result.checked} ids no longer resolve at Telegram.` };
  }
  return { ok: true, id: `All ${result.checked} configured ids resolve` };
}
