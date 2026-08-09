"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserSafe } from "@/server/auth-helpers";
import type { ActionResult } from "@/server/actions/courses";

const idSchema = z.string().cuid();

export async function toggleResourceBookmarkAction(
  resourceId: unknown
): Promise<ActionResult & { bookmarked?: boolean; bookmarkCount?: number }> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;
  const parsed = idSchema.safeParse(resourceId);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const resource = await db.learningResource.findUnique({
    where: { id: parsed.data },
    select: { id: true, published: true },
  });
  if (!resource || !resource.published) return { ok: false, error: "Resource not found." };

  const existing = await db.learningResourceBookmark.findUnique({
    where: { resourceId_userId: { resourceId: parsed.data, userId: user.id } },
  });

  if (existing) {
    const [, updated] = await db.$transaction([
      db.learningResourceBookmark.delete({ where: { id: existing.id } }),
      db.learningResource.update({ where: { id: parsed.data }, data: { bookmarkCount: { decrement: 1 } } }),
    ]);
    return { ok: true, bookmarked: false, bookmarkCount: updated.bookmarkCount };
  }

  const [, updated] = await db.$transaction([
    db.learningResourceBookmark.create({ data: { resourceId: parsed.data, userId: user.id } }),
    db.learningResource.update({ where: { id: parsed.data }, data: { bookmarkCount: { increment: 1 } } }),
  ]);
  return { ok: true, bookmarked: true, bookmarkCount: updated.bookmarkCount };
}

export async function recordResourceViewAction(resourceId: unknown): Promise<void> {
  const parsed = idSchema.safeParse(resourceId);
  if (!parsed.success) return;
  await db.learningResource
    .update({ where: { id: parsed.data }, data: { views: { increment: 1 } } })
    .catch(() => undefined);
}
