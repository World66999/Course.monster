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
import { siteUrl, isBotAdmin } from "./config";
import { getBranding } from "./branding";
import { checkMembership, gateEnabled, requiredChannelUrl } from "./membership";
import {
  MAX_STARS, MIN_STARS, SUGGESTED_STARS,
  completeDonation, createStarInvoice, handlePreCheckout, parseStarAmount,
  type PreCheckout, type SuccessfulPayment,
} from "./donations";
import { iconPlain, type Branding } from "./branding-schema";
import * as render from "./render";
import { lastSearch, recordEvent, rememberSearch, touchUser, type TelegramFrom } from "./users";
import { db } from "@/lib/db";
import { adminHomeScreen, handleAdminCallback, handleAdminInput } from "./admin";


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
  successful_payment?: SuccessfulPayment;
  /** Carries the custom_emoji id when a premium emoji is sent. */
  entities?: { type: string; offset: number; length: number; custom_emoji_id?: string }[];
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
  pre_checkout_query?: PreCheckout;
}

const MAX_TEXT = 200;
type Screen = { text: string; keyboard: InlineKeyboard };

async function setDonateWaiting(userId: string, waiting: boolean): Promise<void> {
  await db.telegramUser.update({ where: { id: userId }, data: { donateAwaitingAmount: waiting } });
}
async function isDonateWaiting(userId: string): Promise<boolean> {
  const row = await db.telegramUser.findUnique({ where: { id: userId }, select: { donateAwaitingAmount: true } });
  return row?.donateAwaitingAmount ?? false;
}

async function startInvoice(
  chatId: string,
  telegramId: string,
  username: string | undefined,
  amount: number,
  b: Branding
): Promise<void> {
  const res = await createStarInvoice({
    chatId,
    telegramUserId: telegramId,
    username: username ?? null,
    amount,
    title: "Support Courses Monster",
    description: `Donate ${amount} Telegram Stars to support the project.`,
  });
  if (!res.ok) await sendMessage(chatId, `${iconPlain(b, "warn")} ${res.error}`);
}

/**
 * Enforces the required-channel gate. Returns true when the caller may proceed.
 *
 * Called on every protected entry point rather than once at /start, so leaving
 * the channel revokes access within the cache TTL instead of lasting forever.
 * An unavailable check never grants access.
 */
async function passesGate(
  telegramId: string,
  chatId: string,
  messageId: number | null,
  b: Branding,
  opts: { fresh?: boolean } = {}
): Promise<boolean> {
  if (!gateEnabled()) return true;
  const result = await checkMembership(telegramId, opts);
  if (result.state === "member") return true;
  const screen =
    result.state === "unavailable"
      ? render.membershipUnavailable(b, requiredChannelUrl())
      : render.joinGate(b, requiredChannelUrl(), opts.fresh === true);
  await show(chatId, messageId, screen);
  return false;
}

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

  // Admin callbacks live in their own namespace and re-check the id themselves.
  if (await handleAdminCallback(q, telegramId, user.id)) return;

  const branding = await getBranding();
  if (q.data === "mb:v") {
    // Verify button: always a FRESH check, bypassing the cache, so joining and
    // immediately verifying can never return a stale "not a member".
    await answerCallbackQuery(q.id);
    const branding = await getBranding();
    if (!allow(telegramId, "verify", 8, 60_000)) {
      await sendMessage(chatId, `${iconPlain(branding, "warn")} Please wait a moment before verifying again.`);
      return;
    }
    if (await passesGate(telegramId, chatId, messageId, branding, { fresh: true })) {
      await show(chatId, messageId, render.welcome(branding, siteUrl()));
    }
    return;
  }

  const gateBranding = await getBranding();
  if (!(await passesGate(telegramId, chatId, messageId, gateBranding))) {
    await answerCallbackQuery(q.id);
    return;
  }

  if (q.data?.startsWith("dn:")) {
    await answerCallbackQuery(q.id);
    const branding = await getBranding();
    const arg = q.data.slice(3);
    if (arg === "menu") {
      await setDonateWaiting(user.id, false);
      await show(chatId, messageId, render.donatePrompt(branding, SUGGESTED_STARS));
      return;
    }
    if (arg === "c") {
      await setDonateWaiting(user.id, true);
      await show(chatId, messageId, render.donateCustomPrompt(branding, MIN_STARS, MAX_STARS));
      return;
    }
    // A suggested amount. The value is re-validated server-side and the invoice
    // is built from the parsed integer, never from the callback string itself.
    const check = parseStarAmount(arg);
    if (!check.ok) return;
    if (!allow(telegramId, "donate", 6, 60_000)) {
      await sendMessage(chatId, `${iconPlain(branding, "warn")} Too many donation attempts. Please wait a moment.`);
      return;
    }
    await startInvoice(chatId, telegramId, q.from.username, check.amount, branding);
    return;
  }

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
  if (m.successful_payment) {
    const result = await completeDonation(m.successful_payment, telegramId);
    // A redelivered update must not thank the user twice.
    if (result.outcome === "completed") {
      await recordEvent(user.id, "DONATION");
      await show(chatId, null, render.donationThanks(b, result.amount));
    }
    return;
  }

  const text = (m.text ?? "").slice(0, MAX_TEXT).trim();
  if (!text) return;

  // A half-finished admin edit consumes the next message before anything else,
  // otherwise "send me the new label" would be treated as a course search.
  if (await handleAdminInput(telegramId, user.id, chatId, text, m.entities)) return;

  // A pending custom-amount entry consumes the next plain message.
  if (!text.startsWith("/") && (await isDonateWaiting(user.id))) {
    const check = parseStarAmount(text);
    if (!check.ok) {
      // A typo must not consume the donation budget, or a few mistakes would
      // lock someone out of donating. Malformed input is still bounded by the
      // general per-user message limit above.
      await sendMessage(chatId, `${iconPlain(b, "warn")} ${check.message}`);
      return;
    }
    if (!allow(telegramId, "donate", 6, 60_000)) {
      await sendMessage(chatId, `${iconPlain(b, "warn")} Too many donation attempts. Please wait a moment.`);
      return;
    }
    await setDonateWaiting(user.id, false);
    await startInvoice(chatId, telegramId, m.from.username, check.amount, b);
    return;
  }
  if (text.startsWith("/") && (await isDonateWaiting(user.id))) {
    await setDonateWaiting(user.id, false);
  }

  // Everything below is protected content.
  if (!(await passesGate(telegramId, chatId, null, b))) return;

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
      case "admin": {
        // Unknown to everyone else: a non-admin gets exactly what any
        // unrecognised command returns, so the command's existence never leaks.
        if (!isBotAdmin(telegramId)) {
          return void (await show(chatId, null, render.help(b, siteUrl())));
        }
        const home = await adminHomeScreen();
        return void (await show(chatId, null, home));
      }
      case "donate":
        return void (await show(chatId, null, render.donatePrompt(b, SUGGESTED_STARS)));
      case "paysupport":
        return void (await show(chatId, null, render.paySupport(b, siteUrl())));
      case "help":
        await recordEvent(user.id, "HELP");
        return void (await show(chatId, null, render.help(b, siteUrl())));
      default:
        return void (await show(chatId, null, render.help(b, siteUrl())));
    }
  }

  // Plain text is treated as a search.
  if (!allow(telegramId, "search", 12, 60_000)) {
    await sendMessage(chatId, `${iconPlain(b, "search")} That's a lot of searching — please wait a moment and try again.`);
    return;
  }
  await rememberSearch(user.id, text);
  await recordEvent(user.id, "SEARCH", { query: text });
  await show(chatId, null, render.searchResults(b, text, await searchPublishedPage(text, 1)));
}

export async function handleUpdate(update: Update): Promise<void> {
  // Telegram expects an answer within seconds, so this is handled first and
  // never queued behind anything else.
  if (update.pre_checkout_query) return handlePreCheckout(update.pre_checkout_query);
  if (update.callback_query) return handleCallback(update.callback_query);
  if (update.message) return handleMessage(update.message);
  // Any other update type is acknowledged and ignored.
}
