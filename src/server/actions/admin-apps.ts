"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth-helpers";
import { logAudit } from "@/lib/audit";
import { appListingFormSchema, parseTags } from "@/lib/validation";
import { deleteOrphanedUploads, deleteUpload } from "@/lib/uploads";
import type { ActionResult } from "@/server/actions/courses";

const idSchema = z.string().cuid();
const idsSchema = z.array(idSchema).min(1).max(200);

function revalidateSite() {
  revalidatePath("/", "layout");
}

async function releaseAppIcon(oldPath: string | null, excludeId: string, keep: string | null): Promise<void> {
  if (!oldPath || !oldPath.startsWith("/uploads/")) return;
  if (keep === oldPath) return;
  const stillUsed = await db.appListing.count({ where: { id: { not: excludeId }, icon: oldPath } });
  if (stillUsed > 0) return;
  await deleteUpload(oldPath);
}

/** Releases screenshots that were removed from the array and aren't referenced elsewhere (icon or another listing's screenshots). */
async function releaseRemovedScreenshots(oldPaths: string[], newPaths: string[], excludeId: string): Promise<void> {
  const removed = oldPaths.filter((p) => p.startsWith("/uploads/") && !newPaths.includes(p));
  for (const path of removed) {
    const stillUsed = await db.appListing.count({
      where: { id: { not: excludeId }, OR: [{ icon: path }, { screenshots: { has: path } }] },
    });
    if (stillUsed > 0) continue;
    await deleteUpload(path);
  }
}

export async function saveAppAction(appId: string | null, input: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = appListingFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;

  const data = {
    name: v.name,
    slug: v.slug,
    icon: v.icon || null,
    screenshots: v.screenshots.filter(Boolean),
    shortDescription: v.shortDescription || null,
    description: v.description || null,
    developer: v.developer.trim() || null,
    projectUrl: v.projectUrl || null,
    sourceUrl: v.sourceUrl || null,
    downloadUrl: v.downloadUrl,
    platform: v.platform,
    category: v.category,
    version: v.version.trim() || null,
    appUpdatedAt: v.appUpdatedAt ? new Date(v.appUpdatedAt) : null,
    license: v.license.trim() || null,
    isOpenSource: v.isOpenSource,
    minAndroidVersion: v.minAndroidVersion.trim() || null,
    architecture: v.architecture.trim() || null,
    fileSizeLabel: v.fileSizeLabel.trim() || null,
    tags: parseTags(v.tags),
    featured: v.featured,
    published: v.published,
  };

  try {
    if (appId) {
      const id = idSchema.parse(appId);
      const existing = await db.appListing.findUnique({ where: { id } });
      if (!existing) return { ok: false, error: "App not found" };

      const app = await db.appListing.update({ where: { id }, data });
      if (existing.icon !== app.icon) {
        await releaseAppIcon(existing.icon, app.id, app.icon);
      }
      await releaseRemovedScreenshots(existing.screenshots, app.screenshots, app.id);
      await logAudit({
        userId: user.id,
        action: "appListing.update",
        entity: "appListing",
        entityId: app.id,
        meta: { name: app.name },
      });
      revalidateSite();
      return { ok: true, id: app.id };
    }

    const last = await db.appListing.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
    const app = await db.appListing.create({ data: { ...data, order: (last?.order ?? 0) + 1 } });
    await logAudit({
      userId: user.id,
      action: "appListing.create",
      entity: "appListing",
      entityId: app.id,
      meta: { name: app.name },
    });
    revalidateSite();
    return { ok: true, id: app.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "An app with this slug already exists." };
    }
    console.error("[admin] saveApp failed:", err);
    return { ok: false, error: "Failed to save app." };
  }
}

export async function deleteAppsAction(ids: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Invalid selection" };

  const doomed = await db.appListing.findMany({
    where: { id: { in: parsed.data } },
    select: { icon: true, screenshots: true },
  });
  const { count } = await db.appListing.deleteMany({ where: { id: { in: parsed.data } } });

  await deleteOrphanedUploads(
    doomed.flatMap((a) => [a.icon, ...a.screenshots]),
    async (paths) => {
      const rows = await db.appListing.findMany({
        where: { OR: [{ icon: { in: paths } }, { screenshots: { hasSome: paths } }] },
        select: { icon: true, screenshots: true },
      });
      return rows.flatMap((r) => [r.icon, ...r.screenshots]).filter((p): p is string => Boolean(p));
    }
  );

  await logAudit({ userId: user.id, action: "appListing.delete", entity: "appListing", meta: { count } });
  revalidateSite();
  return { ok: true };
}

export async function toggleAppPublishedAction(appId: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = idSchema.safeParse(appId);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const existing = await db.appListing.findUnique({ where: { id: parsed.data }, select: { published: true } });
  if (!existing) return { ok: false, error: "App not found" };
  await db.appListing.update({ where: { id: parsed.data }, data: { published: !existing.published } });
  await logAudit({ userId: user.id, action: "appListing.toggle_published", entity: "appListing", entityId: parsed.data });
  revalidateSite();
  return { ok: true };
}

export async function toggleAppFeaturedAction(appId: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = idSchema.safeParse(appId);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const existing = await db.appListing.findUnique({ where: { id: parsed.data }, select: { featured: true } });
  if (!existing) return { ok: false, error: "App not found" };
  await db.appListing.update({ where: { id: parsed.data }, data: { featured: !existing.featured } });
  await logAudit({ userId: user.id, action: "appListing.toggle_featured", entity: "appListing", entityId: parsed.data });
  revalidateSite();
  return { ok: true };
}
