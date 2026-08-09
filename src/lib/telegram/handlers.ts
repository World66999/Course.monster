import "server-only";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAttributionToken } from "./attribution";
import { answerCallbackQuery, editMessageText, sendMessage, type InlineKeyboard } from "./api";
import { decode, type Callback } from "./callback";
import {
  getPublishedBotCourseBySlug,
  getPublishedBotCourse,
  getUpcomingBotCourse,
  listPublishedPage,
  listUpcomingPage,
  searchPublishedPage,
} from "./catalog";
import { siteUrl } from "./config";
import { getBranding } from "./branding";
import type { Branding } from "./branding-schema";
import * as render from "./render";
import { lastSearch, recordEvent, rememberSearch, touchUser, type TelegramFrom } from "./users";

/**
 * Update dispatcher.
 *
 * Everything arriving here is untrusted: callback data is parsed for *shape*
 * only and every course is re-resolved from the database under the same
 * `published` gate the website uses, so tampering with a course id can only
 * ever produce "not available".
 */

interface Message {
  message_id: number;
  from?: TelegramFrom;
  chat: { id: number };
  text?: string;
}
interface CallbackQuery {
  id: string;
  from: TelegramFrom;
  data?: string;
  message?: { message_id: number; chat: { id: number } };
}
export interface Update {
  update_id: number;
  message?: Message;
  callback_query?: CallbackQuery;
}

const MAX_TEXT = 200;
type Screen = { text: string; keyboard: InlineKeyboard };

/** Per-user throttles. Reuses the app's existing limiter — no second system. */
function allow(telegramId: string, bucket: string, limit: number, windowMs: number): boolean {
  return checkRateLimit(`tg:${bucket}:${telegramId}`, { limit, windowMs }).ok;
}

async function show(chatId: string, messageId: number | null, screen: Screen): Promise<void> {
  // Editing in place keeps navigation from filling the chat with new messages.
  if (messageId !== null) {
    const res = await editMessageText(chatId, messageId, screen.text, { replyMarkup: screen.keyboard });
    // "message is not modified" is benign (double tap on the same button).
    if (res.ok || res.description.includes("message is not modified")) return;
  }
  await sendMessage(chatId, screen.text, { replyMarkup: screen.keyboard });
}

async function screenFor(cb: Callback, userId: string, b: Branding): Promise<Screen> {
  switch (cb.kind) {
    case "home":
      return render.welcome(b, siteUrl());
    case "help":
      return render.help(b, siteUrl());
    case "browse": {
      await recordEvent(userId, "BROWSE");
      return render.browseList(b, await listPublishedPage(cb.page));
    }
    case "upcoming": {
      await recordEvent(userId, "UPCOMING_VIEW");
      return render.upcomingList(b, await listUpcomingPage(cb.page));
    }
    case "search": {
      const previous = await lastSearch(userId);
      if (!previous) return render.searchPrompt(b);
      return render.searchResults(b, previous, await searchPublishedPage(previous, cb.page));
    }
    case "course": {
      // Re-resolved server-side; an unpublished/deleted course simply vanishes.
      const published = await getPublishedBotCourse(cb.courseId);
      const course = published ?? (await getUpcomingBotCourse(cb.courseId));
      if (!course) return render.courseUnavailable(b);
      await recordEvent(userId, "COURSE_VIEW", { courseId: course.id });
      return render.courseDetail(b, course, {
        from: cb.from,
        page: cb.page,
        siteUrl: siteUrl(),
        downloadable: Boolean(published),
      });
    }
    case "noop":
      return render.welcome(b, siteUrl());
    case "download":
      // Handled by the caller so it can answer the callback distinctly.
      return render.errorMessage(b);
  }
}

async function handleCallback(q: CallbackQuery): Promise<void> {
  const telegramId = String(q.from.id);
  const chatId = q.message ? String(q.message.chat.id) : telegramId;
  const messageId = q.message?.message_id ?? null;

  // Always answer, even when rejecting, or the client keeps spinning.
  if (!allow(telegramId, "cb", 40, 60_000)) {
    await answerCallbackQuery(q.id, "You're going a bit fast — try again in a moment.");
    return;
  }

  const user = await touchUser(q.from);
  if (user.blocked) {
    await answerCallbackQuery(q.id, "This bot is not available for your account.");
    return;
  }

  const branding = await getBranding();
  const cb = q.data ? decode(q.data) : null;
  if (!cb) {
    // Malformed or tampered callback data: acknowledge and ignore.
    await answerCallbackQuery(q.id);
    console.warn("[telegram] rejected malformed callback data");
    return;
  }

  if (cb.kind === "noop") {
    await answerCallbackQuery(q.id);
    return;
  }

  if (cb.kind === "download") {
    if (!allow(telegramId, "dl", 10, 5 * 60_000)) {
      await answerCallbackQuery(q.id, "Too many download requests. Please wait a moment.", true);
      return;
    }
    const course = await getPublishedBotCourse(cb.courseId);
    if (!course) {
      await answerCallbackQuery(q.id, "This course is no longer available.", true);
      return;
    }
    await answerCallbackQuery(q.id);
    await recordEvent(user.id, "DOWNLOAD_REQUESTED", { courseId: course.id });
    // Hand off to the website's protected download page — never a file, never
    // a storage path. `src` is attribution metadata only.
    const token = createAttributionToken(telegramId, course.id);
    const url = `${siteUrl()}/download/${encodeURIComponent(course.slug)}?src=${encodeURIComponent(token)}`;
    await show(chatId, messageId, render.downloadHandoff(branding, course, url));
    return;
  }

  await answerCallbackQuery(q.id);
  await show(chatId, messageId, await screenFor(cb, user.id, branding));
}

async function handleMessage(m: Message): Promise<void> {
  if (!m.from) return;
  const telegramId = String(m.from.id);
  const chatId = String(m.chat.id);

  if (!allow(telegramId, "msg", 20, 60_000)) return;

  const user = await touchUser(m.from);
  if (user.blocked) return;

  const b = await getBranding();
  const text = (m.text ?? "").slice(0, MAX_TEXT).trim();
  if (!text) return;

  if (text.startsWith("/")) {
    // Strip any @botusername suffix Telegram adds in groups.
    const parts = text.split(/\s+/);
    const command = parts[0].slice(1).split("@")[0].toLowerCase();
    switch (command) {
      case "start": {
        await recordEvent(user.id, "START");
        // Deep link: t.me/<bot>?start=<course-slug>. The payload is a public
        // slug, never a database id, and is re-resolved under the published
        // gate — an unknown or unpublished slug just opens the main menu.
        const payload = parts[1] ?? "";
        if (/^[a-z0-9-]{1,64}$/.test(payload)) {
          const course = await getPublishedBotCourseBySlug(payload);
          if (course) {
            await recordEvent(user.id, "COURSE_VIEW", { courseId: course.id });
            return void (await show(
              chatId,
              null,
              render.courseDetail(b, course, { from: "browse", page: 1, siteUrl: siteUrl(), downloadable: true })
            ));
          }
        }
        return void (await show(chatId, null, render.welcome(b, siteUrl()))); 
      }
      case "courses":
        await recordEvent(user.id, "BROWSE");
        return void (await show(chatId, null, render.browseList(b, await listPublishedPage(1))));
      case "upcoming":
        await recordEvent(user.id, "UPCOMING_VIEW");
        return void (await show(chatId, null, render.upcomingList(b, await listUpcomingPage(1))));
      case "search":
        return void (await show(chatId, null, render.searchPrompt(b)));
      case "website":
        return void (await show(chatId, null, render.welcome(b, siteUrl()))); 
      case "help":
        await recordEvent(user.id, "HELP");
        return void (await show(chatId, null, render.help(b, siteUrl())));
      default:
        return void (await show(chatId, null, render.help(b, siteUrl())));
    }
  }

  // Plain text is treated as a search.
  if (!allow(telegramId, "search", 12, 60_000)) {
    await sendMessage(chatId, "🔎 That's a lot of searching — please wait a moment and try again.");
    return;
  }
  await rememberSearch(user.id, text);
  await recordEvent(user.id, "SEARCH", { query: text });
  await show(chatId, null, render.searchResults(b, text, await searchPublishedPage(text, 1)));
}

export async function handleUpdate(update: Update): Promise<void> {
  if (update.callback_query) return handleCallback(update.callback_query);
  if (update.message) return handleMessage(update.message);
  // Any other update type is acknowledged and ignored.
}
