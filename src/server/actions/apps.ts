"use server";

import { z } from "zod";
import { db } from "@/lib/db";

const idSchema = z.string().cuid();

/** Fire-and-forget click-through counter — no bookmarking for Apps Hub (see plan). */
export async function recordAppViewAction(appId: unknown): Promise<void> {
  const parsed = idSchema.safeParse(appId);
  if (!parsed.success) return;
  await db.appListing
    .update({ where: { id: parsed.data }, data: { views: { increment: 1 } } })
    .catch(() => undefined);
}
