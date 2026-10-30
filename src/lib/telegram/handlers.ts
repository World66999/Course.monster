import "server-only";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAttributionToken } from "./attribution";
import { answerCallbackQuery, editMessageText, getMe, sendMessage, type InlineKeyboard } from "./api";
import { runTimed, updateLabel } from "./timing";
import { addressedText, isGroupChat, type BotIdentity } from "./addressing";
import { decode, type Callback } from "./callback";
import {
  getPublishedBotCourseBySlug,
  getPublishedBotCourse,
  getUpcomingBotCourse,
  listPublishedPage,
  listUpcomingPage,
  searchPublishedPage,
} from "./catalog";
import { siteUrl, isBotAdmin, botUsername } from "./config";
import { getBranding } from "./branding";
import { checkMembership, gateEnabled, invalidateMembership, requiredChannelUrl } from "./membership";
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
import {
  parseRzpCallback,
  premiumScreen,
  razorpayErrorScreen,
  razorpayLinkScreen,
  razorpayNeedsLinkScreen,
  razorpayPreparingScreen,
  statusScreen,
} from "./premium-screens";
import { inrPricesSafe, supportTelegram } from "@/lib/razorpay-config";
import { createTelegramLink } from "@/lib/razorpay-payments";
import { formatInr } from "@/lib/premium-plans";
import { consumeLinkToken, findLinkedUser, LINK_PREFIX } from "@/lib/telegram-link";
import { canDownloadDirect, isActiveUntil } from "@/lib/premium";
import { createHandoffToken } from "@/lib/download-token";
import { kickFromGroup, mayJoinPremiumGroups } from "@/lib/premium-lapse";


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
  chat: { id: number; type?: string };
  text?: string;
  reply_to_message?: { from?: { id: number } };
  successful_payment?: SuccessfulPayment;
  /** Carries the custom_emoji id when a premium emoji is sent. */
  entities?: { type: string; offset: number; length: number; custom_emoji_id?: string; user?: { id: number } }[];
}
interface CallbackQuery {
  id: string;
  from: TelegramFrom;
  data?: string;
  message?: { message_id: number; chat: { id: number } };
}
interface ChatMemberUpdated {
  chat: { id: number; type: string };
  from: TelegramFrom;
  old_chat_member: { status: string; user: TelegramFrom };
  new_chat_member: { status: string; user: TelegramFrom & { is_bot?: boolean } };
}
export interface Update {
  update_id: number;
  message?: Message;
  callback_query?: CallbackQuery;
  pre_checkout_query?: PreCheckout;
  chat_member?: ChatMemberUpdated;
}

/**
 * Join gate for the private members' groups. Invite links are single-use and
 * revoked on lapse, but a link can still be forwarded or used late; whoever
 * joins a registered Premium group without active Premium is removed again.
 * Groups the site doesn't know about are left alone.
 */
async function handleChatMember(u: ChatMemberUpdated): Promise<void> {
  // Someone leaving anywhere the bot can see drops their cached channel
  // membership, so the gate re-checks on their next tap.
  if (["left", "kicked"].includes(u.new_chat_member.status)) invalidateMembership(String(u.new_chat_member.user.id));
  const joined =
    ["member", "restricted"].includes(u.new_chat_member.status) &&
    ["left", "kicked"].includes(u.old_chat_member.status);
  if (!joined || u.new_chat_member.user.is_bot) return;
  const chatId = String(u.chat.id);
  const group = await db.premiumChat.findFirst({
    where: { kind: "TELEGRAM_GROUP", telegramChatId: chatId },
    select: { id: true },
  });
  if (!group) return;
  const telegramId = String(u.new_chat_member.user.id);
  if (await mayJoinPremiumGroups(telegramId)) return;
  await kickFromGroup(chatId, telegramId);
  await sendMessage(
    telegramId,
    "⌛ <b>That group is for Premium members</b>\n\nYour Premium isn't active, so you were removed. Renew to rejoin.",
    { replyMarkup: [[{ text: "👑 Renew Premium", url: `${siteUrl()}/premium#plans` }]] }
  ).catch(() => {});
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
  // Premium members skip the join-the-channel step entirely. Read from the
  // database on each call, so it stops applying the moment Premium lapses.
  const linked = await findLinkedUser(telegramId);
  if (linked && isActiveUntil(linked.premiumUntil)) return true;
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

/** Premium plans screen with live prices (INR only when Razorpay is configured). */
function premiumPlans(): Screen {
  return premiumScreen(siteUrl(), { inr: inrPricesSafe(), support: supportTelegram() });
}

/**
 * Telegram ids with a Razorpay link being created right now. A double tap or
 * a redelivered callback while the first request is still running is dropped
 * instead of racing it (the database also allows only one open link per plan).
 */
const rzpInflight = new Set<string>();

/**
 * Answers a callback query at most once. The first call goes to Telegram and
 * later ones are no-ops, so a handler can answer straight away (the button's
 * spinner stops immediately) and still pass through code that answers again.
 */
type Ack = (text?: string, showAlert?: boolean) => Promise<unknown>;
function callbackAnswerer(queryId: string): Ack {
  let sent: Promise<unknown> | null = null;
  return (text, showAlert = false) => (sent ??= answerCallbackQuery(queryId, text, showAlert));
}

/**
 * The reasons a pay button is refused with a message of its own. All checks
 * are in memory, so they run before the early answer that every other tap gets.
 */
function razorpayTapRefusal(telegramId: string, chatId: string): { text: string; alert: boolean } | null {
  // A payment link is personal: never post one into a group.
  if (chatId !== telegramId) return { text: "Open the bot in a private chat to pay.", alert: true };
  if (rzpInflight.has(telegramId)) return { text: "Already preparing your payment link…", alert: false };
  if (!allow(telegramId, "rzp-tap", 8, 60_000)) return { text: "You're going a bit fast — please wait a moment.", alert: true };
  return null;
}

async function handleRazorpayCallback(
  choice: "MONTHLY" | "YEARLY" | "back",
  telegramId: string,
  chatId: string,
  messageId: number | null
): Promise<void> {
  if (choice === "back") {
    await show(chatId, messageId, premiumPlans());
    return;
  }
  const support = supportTelegram();
  const linked = await findLinkedUser(telegramId);
  if (!linked) {
    await show(chatId, messageId, razorpayNeedsLinkScreen(siteUrl()));
    return;
  }
  rzpInflight.add(telegramId);
  try {
    // Creating the link takes a Razorpay round trip; show progress meanwhile.
    // Both finish before the final edit, so the progress screen can never
    // land on top of the link.
    const [res] = await Promise.all([
      createTelegramLink(linked.id, telegramId, choice),
      messageId !== null ? show(chatId, messageId, razorpayPreparingScreen()) : Promise.resolve(),
    ]);
    if (!res.ok) {
      await show(chatId, messageId, razorpayErrorScreen(res.error, support));
      return;
    }
    await show(
      chatId,
      messageId,
      razorpayLinkScreen(siteUrl(), { url: res.url, plan: res.plan, amountLabel: formatInr(res.amount), expiresAt: res.expiresAt }, support)
    );
  } catch (err) {
    console.error("[telegram] razorpay link failed:", err instanceof Error ? err.message : "unknown");
    await show(chatId, messageId, razorpayErrorScreen("We couldn't create your payment link just now. Please try again in a moment.", support));
  } finally {
    rzpInflight.delete(telegramId);
  }
}

async function screenFor(cb: Callback, userId: string, b: Branding): Promise<Screen> {
  switch (cb.kind) {
    case "home":
      return render.welcome(b, siteUrl());
    case "help":
      return render.help(b, siteUrl());
    case "browse": {
      void recordEvent(userId, "BROWSE");
      return render.browseList(b, await listPublishedPage(cb.page));
    }
    case "upcoming": {
      void recordEvent(userId, "UPCOMING_VIEW");
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
      void recordEvent(userId, "COURSE_VIEW", { courseId: course.id });
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
  const ack = callbackAnswerer(q.id);

  // Refusals that carry their own message are decided first, in memory.
  if (!allow(telegramId, "cb", 40, 60_000)) {
    await ack("You're going a bit fast — try again in a moment.");
    return;
  }
  const rzpChoice = parseRzpCallback(q.data);
  if (rzpChoice && rzpChoice !== "back") {
    const refusal = razorpayTapRefusal(telegramId, chatId);
    if (refusal) {
      await ack(refusal.text, refusal.alert);
      return;
    }
  }
  const isAdmin = q.data?.startsWith("a:") === true;
  const cb = q.data && !isAdmin ? decode(q.data) : null;
  if (cb?.kind === "download" && !allow(telegramId, "dl", 10, 5 * 60_000)) {
    await ack("Too many download requests. Please wait a moment.", true);
    return;
  }

  // Every other tap is answered now, before any database or network work, so
  // the button never spins while the next screen is prepared. Admin buttons
  // answer themselves, some with a toast describing the result.
  if (!isAdmin) void ack();

  const [user, branding] = await Promise.all([touchUser(q.from), getBranding()]);
  if (user.blocked) {
    await ack("This bot is not available for your account.");
    return;
  }

  // Admin callbacks live in their own namespace and re-check the id themselves.
  if (await handleAdminCallback(q, telegramId, user.id)) return;

  // Buying Premium is about the user's own account, so like /premium it is
  // never behind the channel gate. The callback carries only a plan key; the
  // price is computed on the server.
  if (rzpChoice) {
    await handleRazorpayCallback(rzpChoice, telegramId, chatId, messageId);
    return;
  }

  if (q.data === "mb:v") {
    // Verify button: always a FRESH check, bypassing the cache, so joining and
    // immediately verifying can never return a stale "not a member".
    if (!allow(telegramId, "verify", 8, 60_000)) {
      await sendMessage(chatId, `${iconPlain(branding, "warn")} Please wait a moment before verifying again.`);
      return;
    }
    if (await passesGate(telegramId, chatId, messageId, branding, { fresh: true })) {
      await show(chatId, messageId, render.welcome(branding, siteUrl()));
    }
    return;
  }

  if (!(await passesGate(telegramId, chatId, messageId, branding))) return;

  if (q.data?.startsWith("dn:")) {
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

  if (!cb) {
    // Malformed or tampered callback data: acknowledged above, otherwise ignored.
    console.warn("[telegram] rejected malformed callback data");
    return;
  }

  if (cb.kind === "noop") return;

  if (cb.kind === "download") {
    const [course, linked] = await Promise.all([getPublishedBotCourse(cb.courseId), findLinkedUser(telegramId)]);
    if (!course) {
      await show(chatId, messageId, render.courseUnavailable(branding));
      return;
    }
    void recordEvent(user.id, "DOWNLOAD_REQUESTED", { courseId: course.id });
    // A linked member with access right now gets a direct link bound to their
    // account; the site re-checks it on open. Everyone else is handed off to
    // the website's protected download page — never a file, never a storage
    // path. `src` is attribution metadata only.
    if (linked && (await canDownloadDirect(linked.id, course))) {
      const direct = `${siteUrl()}/dl/${createHandoffToken(linked.id, course.id, telegramId)}`;
      await show(chatId, messageId, render.downloadHandoff(branding, course, direct, { direct: true }));
      return;
    }
    const token = createAttributionToken(telegramId, course.id);
    const page = `/download/${encodeURIComponent(course.slug)}`;
    const url = `${siteUrl()}${page}?src=${encodeURIComponent(token)}`;
    const skipAdsUrl = `${siteUrl()}/premium?next=${encodeURIComponent(page)}#plans`;
    await show(chatId, messageId, render.downloadHandoff(branding, course, url, { skipAdsUrl }));
    return;
  }

  await show(chatId, messageId, await screenFor(cb, user.id, branding));
}

let identity: Promise<BotIdentity | null> | null = null;

/** The bot's own id and username, fetched once per process. */
function botIdentity(): Promise<BotIdentity | null> {
  identity ??= getMe().then((r) => {
    if (r.ok) return { id: r.result.id, username: r.result.username };
    identity = null; // retry on the next group message
    const username = botUsername()?.replace(/^@/, "");
    const id = Number(process.env.TELEGRAM_BOT_TOKEN?.split(":")[0]);
    return username && id ? { id, username } : null;
  });
  return identity;
}

async function handleMessage(m: Message): Promise<void> {
  if (!m.from) return;
  const telegramId = String(m.from.id);
  const chatId = String(m.chat.id);

  // In a group, stay silent unless the message is meant for the bot: a
  // mention, a reply to the bot, or a command. Checked before rate limiting
  // and user tracking so ordinary group chatter costs nothing. A payment
  // receipt is never chatter and always goes through.
  let rawText = m.text;
  let entities = m.entities;
  if (isGroupChat(m.chat.type) && !m.successful_payment) {
    const bot = await botIdentity();
    if (!bot) return;
    const addressed = addressedText(m, bot);
    if (addressed === null) return;
    // Offsets no longer match once a mention is cut out. A bare "@bot" with
    // nothing else gets the help screen.
    if (addressed !== rawText) entities = undefined;
    rawText = addressed || "/help";
  }

  if (!allow(telegramId, "msg", 20, 60_000)) return;

  const [user, b] = await Promise.all([touchUser(m.from), getBranding()]);
  if (user.blocked) return;
  if (m.successful_payment) {
    const result = await completeDonation(m.successful_payment, telegramId);
    // A redelivered update must not thank the user twice.
    if (result.outcome === "completed") {
      void recordEvent(user.id, "DONATION");
      await show(chatId, null, render.donationThanks(b, result.amount));
    }
    return;
  }

  const text = (rawText ?? "").slice(0, MAX_TEXT).trim();
  if (!text) return;

  // A half-finished admin edit consumes the next message before anything else,
  // otherwise "send me the new label" would be treated as a course search.
  if (await handleAdminInput(telegramId, user.id, chatId, text, entities)) return;

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

  // Account linking, plan info and status are never behind the channel gate:
  // they are about the user's own account, not catalog content.
  if (text.startsWith("/")) {
    const [head, arg = ""] = text.split(/\s+/);
    const cmd = head!.slice(1).split("@")[0]!.toLowerCase();
    if (cmd === "start" && arg.startsWith(LINK_PREFIX)) {
      if (!allow(telegramId, "link", 5, 10 * 60_000)) {
        return void (await sendMessage(chatId, "Too many attempts. Please wait a few minutes."));
      }
      const res = await consumeLinkToken(arg.slice(LINK_PREFIX.length), telegramId);
      return void (await sendMessage(
        chatId,
        res.ok
          ? `✅ <b>Telegram linked</b> to ${render.esc(res.userName)}.\n\nYou'll get payment confirmations, expiry reminders and support replies here. Try /mystatus.`
          : res.reason === "expired"
            ? "That link has expired. Open your account page on the website and tap Connect Telegram again."
            : "That link isn't valid any more. Open your account page on the website and tap Connect Telegram again."
      ));
    }
    if (cmd === "premium") {
      return void (await show(chatId, null, premiumPlans()));
    }
    // Public links: never behind the channel gate or Premium.
    if (cmd === "community") {
      return void (await show(chatId, null, render.community()));
    }
    if (cmd === "mystatus") {
      const linked = await db.user.findFirst({
        where: { telegramId, disabled: false },
        select: {
          name: true,
          premiumUntil: true,
          subscriptions: { where: { status: "ACTIVE" }, orderBy: { expiresAt: "desc" }, take: 1, select: { plan: true } },
        },
      });
      return void (await show(
        chatId,
        null,
        statusScreen(
          siteUrl(),
          linked ? { name: linked.name, premiumUntil: linked.premiumUntil, plan: linked.subscriptions[0]?.plan ?? null } : null
        )
      ));
    }
  }

  // Everything below is protected content.
  if (!(await passesGate(telegramId, chatId, null, b))) return;

  if (text.startsWith("/")) {
    // Strip any @botusername suffix Telegram adds in groups.
    const parts = text.split(/\s+/);
    const command = parts[0].slice(1).split("@")[0].toLowerCase();
    switch (command) {
      case "start": {
        void recordEvent(user.id, "START");
        // Deep link: t.me/<bot>?start=<course-slug>. The payload is a public
        // slug, never a database id, and is re-resolved under the published
        // gate — an unknown or unpublished slug just opens the main menu.
        const payload = parts[1] ?? "";
        if (/^[a-z0-9-]{1,64}$/.test(payload)) {
          const course = await getPublishedBotCourseBySlug(payload);
          if (course) {
            void recordEvent(user.id, "COURSE_VIEW", { courseId: course.id });
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
        void recordEvent(user.id, "BROWSE");
        return void (await show(chatId, null, render.browseList(b, await listPublishedPage(1))));
      case "upcoming":
        void recordEvent(user.id, "UPCOMING_VIEW");
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
        void recordEvent(user.id, "HELP");
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
  // The search runs alongside the bookkeeping; analytics never waits.
  void recordEvent(user.id, "SEARCH", { query: text });
  const [, results] = await Promise.all([rememberSearch(user.id, text), searchPublishedPage(text, 1)]);
  await show(chatId, null, render.searchResults(b, text, results));
}

export async function handleUpdate(update: Update): Promise<void> {
  return runTimed(updateLabel(update), () => dispatchUpdate(update));
}

async function dispatchUpdate(update: Update): Promise<void> {
  // Telegram expects an answer within seconds, so this is handled first and
  // never queued behind anything else.
  if (update.pre_checkout_query) return handlePreCheckout(update.pre_checkout_query);
  if (update.callback_query) return handleCallback(update.callback_query);
  if (update.chat_member) return handleChatMember(update.chat_member);
  if (update.message) return handleMessage(update.message);
  // Any other update type is acknowledged and ignored.
}
