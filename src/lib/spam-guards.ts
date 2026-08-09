import "server-only";
import { checkRateLimit } from "@/lib/rate-limit";

export interface PostingRateSettings {
  rateLimitCount: number;
  rateLimitWindowMinutes: number;
  cooldownSeconds: number;
}

/** Rate limit + cooldown, both keyed per-user (not IP — see plan's anti-spam layering). */
export function checkPostingRate(
  userId: string,
  kind: "comment" | "review" | "report" | "chat" | "courseRequest" | "requestComment",
  settings: PostingRateSettings
): { ok: true } | { ok: false; error: string } {
  const rl = checkRateLimit(`${kind}:${userId}`, {
    limit: settings.rateLimitCount,
    windowMs: settings.rateLimitWindowMinutes * 60_000,
  });
  if (!rl.ok) {
    return { ok: false, error: "You're posting too frequently. Please slow down and try again later." };
  }
  if (settings.cooldownSeconds > 0) {
    const cooldown = checkRateLimit(`${kind}-cooldown:${userId}`, {
      limit: 1,
      windowMs: settings.cooldownSeconds * 1000,
    });
    if (!cooldown.ok) {
      return { ok: false, error: "Please wait a few seconds before posting again." };
    }
  }
  return { ok: true };
}

/** Collapse whitespace/case so trivial re-formatting doesn't dodge duplicate detection. */
export function normalizeText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}
