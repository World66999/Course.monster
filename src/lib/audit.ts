import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function logAudit(entry: {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        meta: entry.meta,
      },
    });
  } catch (err) {
    // Auditing must never break the main operation.
    console.error("[audit] failed to write audit log:", err);
  }
}
