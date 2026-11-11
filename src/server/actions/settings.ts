"use server";

import { z } from "@/lib/zod";
import { requireAdmin } from "@/server/auth-helpers";
import { saveSiteSettings } from "@/lib/settings";
import { logAudit } from "@/lib/audit";
import type { ActionResult } from "@/server/actions/courses";

export async function saveSettingsAction(input: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  try {
    await saveSiteSettings(input);
    await logAudit({ userId: user.id, action: "settings.update", entity: "settings" });
    return { ok: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issue = err.issues[0];
      return {
        ok: false,
        error: issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid settings",
      };
    }
    console.error("[admin] saveSettings failed:", err);
    return { ok: false, error: "Failed to save settings." };
  }
}
