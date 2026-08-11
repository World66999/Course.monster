/**
 * Identity of the *downloader* Telegram bot.
 *
 * This is deliberately NOT the CourseVault bot. Two separate bots exist and are
 * easy to confuse:
 *
 *   @Coursevault_in_bot          — the CourseVault bot (courses, membership gate
 *                                  on @Matrix_Bots_in). Exposed as
 *                                  NEXT_PUBLIC_TELEGRAM_BOT.
 *   @You_tubevideodownloader_bot — Bot9, the social-media downloader. This file.
 *
 * Keeping the downloader's identity in its own module means the two can never be
 * swapped by editing one shared constant, and a test can assert the separation.
 *
 * The website downloader does not depend on this bot in any way: it is an
 * alternative offered to users, never a fallback the site relies on. If Telegram
 * is unreachable the website download path is completely unaffected.
 */

const DEFAULT_DOWNLOADER_BOT = "You_tubevideodownloader_bot";

/** Telegram usernames are 5–32 chars of [A-Za-z0-9_]; anything else is ignored. */
function sanitizeUsername(raw: string | undefined): string | null {
  const value = (raw ?? "").trim().replace(/^@/, "");
  return /^[A-Za-z0-9_]{5,32}$/.test(value) ? value : null;
}

/** Username without the leading "@". */
export function downloaderBotUsername(): string {
  return sanitizeUsername(process.env.NEXT_PUBLIC_DOWNLOADER_TELEGRAM_BOT) ?? DEFAULT_DOWNLOADER_BOT;
}

/** Display form, with the "@". */
export function downloaderBotHandle(): string {
  return `@${downloaderBotUsername()}`;
}

/** Canonical t.me link. Built from the validated username, never interpolated raw. */
export function downloaderBotUrl(): string {
  return `https://t.me/${downloaderBotUsername()}`;
}
