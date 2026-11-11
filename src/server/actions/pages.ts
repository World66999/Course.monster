"use server";

import { revalidatePath } from "next/cache";
import { z } from "@/lib/zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth-helpers";
import { logAudit } from "@/lib/audit";
import { pageFormSchema } from "@/lib/validation";
import { PAGE_SLUGS, getPageMeta } from "@/lib/pages";
import type { ActionResult } from "@/server/actions/courses";

const slugSchema = z.enum(PAGE_SLUGS);

export async function savePageAction(slug: unknown, input: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsedSlug = slugSchema.safeParse(slug);
  if (!parsedSlug.success) return { ok: false, error: "Unknown page" };

  const parsed = pageFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await db.page.upsert({
    where: { slug: parsedSlug.data },
    create: { slug: parsedSlug.data, ...parsed.data },
    update: parsed.data,
  });
  await logAudit({
    userId: user.id,
    action: "page.update",
    entity: "page",
    entityId: parsedSlug.data,
  });
  revalidatePath(getPageMeta(parsedSlug.data)?.path ?? `/${parsedSlug.data}`);
  return { ok: true };
}
