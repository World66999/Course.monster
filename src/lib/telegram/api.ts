import "server-only";
import { botToken, scrub } from "./config";

/**
 * Minimal Telegram Bot API client (Bot API 10.2).
 *
 * Every call is bounded by a timeout, never throws the raw token into a log,
 * and surfaces Telegram's own error codes so callers can distinguish
 * "user blocked the bot" (403) from "slow down" (429) from a real fault.
 */

const API_TIMEOUT_MS = 10_000;

export interface TelegramError {
  ok: false;
  status: number;
  description: string;
  /** Seconds Telegram asks us to wait, from parameters.retry_after on a 429. */
  retryAfter?: number;
}
export type TelegramResult<T> = { ok: true; result: T } | TelegramError;

export async function callTelegram<T = unknown>(
  method: string,
  payload: Record<string, unknown> = {}
): Promise<TelegramResult<T>> {
  let res: Response;
  try {
    // The token lives in the path because that is the only form the Bot API
    // accepts; this URL is never logged or returned to a caller.
    res = await fetch(`https://api.telegram.org/bot${botToken()}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    console.error(`[telegram] ${method} transport failure:`, scrub(err instanceof Error ? err.message : err));
    return { ok: false, status: timedOut ? 504 : 0, description: timedOut ? "timeout" : "network error" };
  }

  let body: { ok?: boolean; result?: T; description?: string; parameters?: { retry_after?: number } };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    console.error(`[telegram] ${method} returned a non-JSON body (status ${res.status})`);
    return { ok: false, status: res.status, description: "invalid response" };
  }

  if (!res.ok || !body.ok) {
    const description = scrub(body.description ?? `HTTP ${res.status}`);
    // 403 is routine (user blocked the bot) — don't log it as an error.
    if (res.status !== 403) console.warn(`[telegram] ${method} failed ${res.status}: ${description}`);
    return { ok: false, status: res.status, description, retryAfter: body.parameters?.retry_after };
  }
  return { ok: true, result: body.result as T };
}

export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
  /**
   * Official Bot API fields (InlineKeyboardButton): `style` must be one of
   * "primary" | "success" | "danger" — omitting it lets Telegram apply its own
   * app-specific default. `icon_custom_emoji_id` shows a custom emoji before
   * the caption and only renders for bots with a Fragment username or a
   * Premium owner; Telegram ignores it otherwise, so it degrades quietly.
   */
  style?: "primary" | "success" | "danger";
  icon_custom_emoji_id?: string;
}
export type InlineKeyboard = InlineButton[][];

interface SendOpts {
  replyMarkup?: InlineKeyboard;
  disablePreview?: boolean;
}

/**
 * Telegram refuses a whole message when a custom emoji is unusable — so one bad
 * configured id could take every screen dark for every user. These strip the
 * custom-emoji bits so a send can be retried as plain text rather than lost.
 */
const CUSTOM_EMOJI_FAILURE = /custom emoji|CUSTOM_EMOJI|EMOJI_INVALID|emoji-id|not enough rights.*emoji/i;

function stripTgEmoji(text: string): string {
  // Replace the tag with its fallback body, which is a real emoji by contract.
  return text.replace(/<tg-emoji\s+emoji-id="[^"]*"\s*>([\s\S]*?)<\/tg-emoji>/g, "$1");
}

function stripKeyboardEmoji(keyboard?: InlineKeyboard): InlineKeyboard | undefined {
  if (!keyboard) return keyboard;
  return keyboard.map((row) =>
    row.map((button) => {
      const copy = { ...button };
      delete copy.icon_custom_emoji_id;
      return copy;
    })
  );
}

function usesCustomEmoji(text: string, keyboard?: InlineKeyboard): boolean {
  return text.includes("<tg-emoji") || Boolean(keyboard?.some((r) => r.some((b) => b.icon_custom_emoji_id)));
}

/** Records the most recent custom-emoji rejection so the admin panel can show it. */
let lastCustomEmojiError: { at: number; description: string } | null = null;
export function getLastCustomEmojiError() {
  return lastCustomEmojiError;
}
export function clearLastCustomEmojiError() {
  lastCustomEmojiError = null;
}

/** Telegram hard-caps message text at 4096 characters. */
export const MAX_MESSAGE_CHARS = 4096;

export async function sendMessage(chatId: string, text: string, opts: SendOpts = {}) {
  const body = (t: string, kb?: InlineKeyboard) => ({
    chat_id: chatId,
    text: t.slice(0, MAX_MESSAGE_CHARS),
    parse_mode: "HTML",
    link_preview_options: { is_disabled: opts.disablePreview ?? true },
    ...(kb ? { reply_markup: { inline_keyboard: kb } } : {}),
  });

  const res = await callTelegram<{ message_id: number }>("sendMessage", body(text, opts.replyMarkup));
  if (res.ok || !usesCustomEmoji(text, opts.replyMarkup) || !CUSTOM_EMOJI_FAILURE.test(res.description)) {
    return res;
  }
  // Custom emoji were the problem: deliver the message without them rather than
  // not at all. The configured ids stay stored so nothing the admin set is lost.
  lastCustomEmojiError = { at: Date.now(), description: res.description };
  console.warn("[telegram] custom emoji rejected, retrying without:", res.description);
  return callTelegram<{ message_id: number }>(
    "sendMessage",
    body(stripTgEmoji(text), stripKeyboardEmoji(opts.replyMarkup))
  );
}

/**
 * Editing the existing message is what keeps navigation from spamming the
 * chat with a new message per button press.
 */
export async function editMessageText(chatId: string, messageId: number, text: string, opts: SendOpts = {}) {
  const body = (t: string, kb?: InlineKeyboard) => ({
    chat_id: chatId,
    message_id: messageId,
    text: t.slice(0, MAX_MESSAGE_CHARS),
    parse_mode: "HTML",
    link_preview_options: { is_disabled: opts.disablePreview ?? true },
    ...(kb ? { reply_markup: { inline_keyboard: kb } } : {}),
  });

  const res = await callTelegram("editMessageText", body(text, opts.replyMarkup));
  if (res.ok || !usesCustomEmoji(text, opts.replyMarkup) || !CUSTOM_EMOJI_FAILURE.test(res.description)) {
    return res;
  }
  lastCustomEmojiError = { at: Date.now(), description: res.description };
  console.warn("[telegram] custom emoji rejected on edit, retrying without:", res.description);
  return callTelegram("editMessageText", body(stripTgEmoji(text), stripKeyboardEmoji(opts.replyMarkup)));
}

/**
 * Must be called for every callback query or the client spins on a progress
 * bar (Bot API: "necessary to react by calling answerCallbackQuery even if no
 * notification to the user is needed").
 */
export function answerCallbackQuery(id: string, text?: string, showAlert = false) {
  return callTelegram("answerCallbackQuery", {
    callback_query_id: id,
    ...(text ? { text: text.slice(0, 200) } : {}),
    ...(showAlert ? { show_alert: true } : {}),
  });
}

export function getWebhookInfo() {
  return callTelegram<{
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
    ip_address?: string;
    last_error_date?: number;
    last_error_message?: string;
    max_connections?: number;
    allowed_updates?: string[];
  }>("getWebhookInfo");
}

/**
 * Resolves custom emoji ids to their stickers. An id that does not exist simply
 * comes back missing from the array, which is how a configured id is validated
 * before it is ever stored.
 */
export function getCustomEmojiStickers(ids: string[]) {
  return callTelegram<{ custom_emoji_id: string; emoji?: string; set_name?: string }[]>(
    "getCustomEmojiStickers",
    { custom_emoji_ids: ids.slice(0, 200) }
  );
}

export function getForumTopicIconStickers() {
  return callTelegram<{ custom_emoji_id?: string; emoji?: string; set_name?: string }[]>(
    "getForumTopicIconStickers",
    {}
  );
}

export function getStickerSet(name: string) {
  return callTelegram<{
    name: string;
    title: string;
    sticker_type: string;
    stickers: { custom_emoji_id?: string; emoji?: string }[];
  }>("getStickerSet", { name });
}

export function getMe() {
  return callTelegram<{ id: number; username: string; first_name: string }>("getMe");
}

/**
 * `scope` targets a single chat. Telegram resolves a user's command menu by
 * taking the first scope that is set, chat-specific first — which is how an
 * admin-only command stays out of everyone else's menu.
 */
export function setMyCommands(
  commands: { command: string; description: string }[],
  scope?: { type: "chat"; chat_id: string }
) {
  return callTelegram("setMyCommands", { commands, ...(scope ? { scope } : {}) });
}

export function deleteMyCommands(scope?: { type: "chat"; chat_id: string }) {
  return callTelegram("deleteMyCommands", { ...(scope ? { scope } : {}) });
}

export function setWebhook(url: string, secretToken: string) {
  return callTelegram("setWebhook", {
    url,
    secret_token: secretToken,
    // Only what the bot actually handles — fewer updates, less to validate.
    // pre_checkout_query is essential: without it Telegram never delivers the
    // payment confirmation step and every Stars payment stalls silently.
    allowed_updates: ["message", "callback_query", "pre_checkout_query"],
    max_connections: 40,
  });
}

export function deleteWebhook() {
  return callTelegram("deleteWebhook", {});
}
