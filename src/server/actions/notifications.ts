"use server";

import { z } from "zod";
import { requireUserSafe } from "@/server/auth-helpers";
import { markNotificationsRead } from "@/lib/notifications";
import type { ActionResult } from "@/server/actions/courses";

const idsSchema = z.array(z.string().cuid()).max(100).optional();

export async function markNotificationsReadAction(ids?: unknown): Promise<ActionResult> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;

  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  await markNotificationsRead(auth.user.id, parsed.data);
  return { ok: true };
}
