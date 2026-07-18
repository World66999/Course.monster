"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth-helpers";
import { logAudit } from "@/lib/audit";
import { categoryFormSchema } from "@/lib/validation";
import type { ActionResult } from "@/server/actions/courses";

const idSchema = z.string().cuid();

export async function saveCategoryAction(
  categoryId: string | null,
  input: unknown
): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = categoryFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const v = parsed.data;
  const data = {
    name: v.name,
    slug: v.slug,
    description: v.description || null,
    icon: v.icon || null,
  };

  try {
    let id: string;
    if (categoryId) {
      const parsedId = idSchema.parse(categoryId);
      await db.category.update({ where: { id: parsedId }, data });
      id = parsedId;
    } else {
      const last = await db.category.findFirst({
        orderBy: { order: "desc" },
        select: { order: true },
      });
      const created = await db.category.create({
        data: { ...data, order: (last?.order ?? 0) + 1 },
      });
      id = created.id;
    }
    await logAudit({
      userId: user.id,
      action: categoryId ? "category.update" : "category.create",
      entity: "category",
      entityId: id,
      meta: { name: v.name },
    });
    revalidatePath("/", "layout");
    return { ok: true, id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "A category with this slug already exists." };
    }
    console.error("[admin] saveCategory failed:", err);
    return { ok: false, error: "Failed to save category." };
  }
}

export async function deleteCategoryAction(id: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid category" };

  // Courses keep existing (categoryId becomes null via onDelete: SetNull).
  const category = await db.category.delete({ where: { id: parsed.data } }).catch(() => null);
  if (!category) return { ok: false, error: "Category not found" };

  await logAudit({
    userId: user.id,
    action: "category.delete",
    entity: "category",
    entityId: parsed.data,
    meta: { name: category.name },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function moveCategoryAction(id: unknown, direction: "up" | "down"): Promise<ActionResult> {
  await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid category" };

  const category = await db.category.findUnique({ where: { id: parsed.data } });
  if (!category) return { ok: false, error: "Category not found" };

  const neighbor = await db.category.findFirst({
    where:
      direction === "up" ? { order: { lt: category.order } } : { order: { gt: category.order } },
    orderBy: direction === "up" ? { order: "desc" } : { order: "asc" },
  });
  if (!neighbor) return { ok: true };

  await db.$transaction([
    db.category.update({ where: { id: category.id }, data: { order: neighbor.order } }),
    db.category.update({ where: { id: neighbor.id }, data: { order: category.order } }),
  ]);
  revalidatePath("/", "layout");
  return { ok: true };
}
