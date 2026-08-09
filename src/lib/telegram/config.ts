import "server-only";

/**
 * Server-only Telegram configuration.
 *
 * The bot token is read from the environment on every use and is never
 * exported, logged, embedded in a URL we hand out, or shipped to the client.
 * `server-only` makes an accidental client import a build error rather than a
 * runtime token leak.
 */

export function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return token;
}

export function hasBotToken(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

/**
 * Value Telegram must echo in X-Telegram-Bot-Api-Secret-Token. Telegram allows
 * 1-256 chars of A-Z a-z 0-9 _ - (Bot API "setWebhook").
 */
export function webhookSecret(): string {
  const s = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!s) throw new Error("TELEGRAM_WEBHOOK_SECRET is not set");
  return s;
}

/**
 * Unguessable path segment for the webhook endpoint. Defence in depth beside
 * the secret-token header — the token itself never appears in the URL.
 */
export function webhookPathSegment(): string {
  const s = process.env.TELEGRAM_WEBHOOK_PATH;
  if (!s) throw new Error("TELEGRAM_WEBHOOK_PATH is not set");
  return s;
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://courses.monster").replace(/\/+$/, "");
}

/**
 * Telegram user ids allowed to use in-bot admin commands, comma-separated.
 * Empty means nobody — the admin command then behaves as if it doesn't exist.
 */
export function adminIds(): Set<string> {
  const raw = process.env.TELEGRAM_ADMIN_IDS ?? "";
  return new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter((id) => /^\d{1,20}$/.test(id))
  );
}

export function isBotAdmin(telegramId: string): boolean {
  return adminIds().has(telegramId);
}

/** Public bot username, used only to build t.me deep links on the website. */
export function botUsername(): string | null {
  return process.env.NEXT_PUBLIC_TELEGRAM_BOT ?? null;
}

/** Redacts anything token-shaped before a value reaches a log. */
export function scrub(value: unknown): string {
  const text = typeof value === "string" ? value : String(value);
  const token = process.env.TELEGRAM_BOT_TOKEN;
  let out = token ? text.split(token).join("<redacted>") : text;
  // Also catch a token pattern we didn't source from the env (e.g. echoed back
  // inside a Telegram error payload): <digits>:<35-ish base64url chars>.
  out = out.replace(/\b\d{6,12}:[A-Za-z0-9_-]{30,}\b/g, "<redacted>");
  return out;
}
