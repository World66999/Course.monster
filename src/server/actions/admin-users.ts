"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth-helpers";
import { logAudit } from "@/lib/audit";
import type { ActionResult } from "@/server/actions/courses";

const idSchema = z.string().cuid();

export async function setUserDisabledAction(id: unknown, disabled: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsedId = idSchema.safeParse(id);
  const parsedDisabled = z.boolean().safeParse(disabled);
  if (!parsedId.success || !parsedDisabled.success) return { ok: false, error: "Invalid request" };

  const target = await db.user.findUnique({ where: { id: parsedId.data }, select: { role: true } });
  if (!target) return { ok: false, error: "User not found" };
  // Never let this UI disable staff — prevents accidental admin/editor lockout.
  if (target.role === "ADMIN" || target.role === "EDITOR") {
    return { ok: false, error: "Staff accounts can't be disabled here." };
  }

  await db.user.update({ where: { id: parsedId.data }, data: { disabled: parsedDisabled.data } });
  await logAudit({
    userId: admin.id,
    action: parsedDisabled.data ? "user.disable" : "user.restore",
    entity: "user",
    entityId: parsedId.data,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
