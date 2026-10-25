import type { InlineButton, InlineKeyboard } from "./api";
import { encode } from "./callback";
import type { BotCourse, Page } from "./catalog";
import {
  buttonExtras,
  iconHtml,
  iconPlain,
  labelText,
  premiumIconId,
  type Branding,
  type IconKey,
  type LabelKey,
} from "./branding-schema";

/**
 * Message builders. Everything user- or admin-supplied is HTML-escaped because
 * messages are sent with parse_mode: "HTML"; an unescaped "<" in a course
 * title would otherwise break the message or inject markup.
 *
 * No emoji or button caption is hard-coded here — every one resolves through
 * the branding tables, so the Icon Manager and Button Label Manager are the
 * only places they are defined.
 */

export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function clamp(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export interface Screen {
  text: string;
  keyboard: InlineKeyboard;
}

/**
 * The single button factory — Bot5's `make_btn` equivalent. Caption is composed
 * as "<icon> <label>", and Telegram-side presentation (style, premium icon)
 * comes from the same branding entry.
 *
 * Admin-supplied captions are *not* HTML-escaped: Telegram button text is plain
 * text and is never parsed as HTML, so escaping here would show literal
 * `&amp;` to users. The label schema bounds length and rejects empty values.
 */
function btn(
  b: Branding,
  opts: { label: LabelKey; icon?: IconKey; callback?: string; url?: string }
): InlineButton {
  const extras = buttonExtras(b, opts.label);
  // A per-button icon id set on the label wins; otherwise a premium *icon*
  // supplies one, which is what makes premium emoji show up on buttons at all.
  const customEmojiId = extras.icon_custom_emoji_id ?? (opts.icon ? premiumIconId(b, opts.icon) : null);

  // Telegram draws the custom emoji before the caption, so prefixing the plain
  // fallback as well would render the glyph twice.
  const caption =
    opts.icon && !customEmojiId
      ? `${iconPlain(b, opts.icon)} ${labelText(b, opts.label)}`.trim()
      : labelText(b, opts.label);

  return {
    // Belt and braces: Telegram rejects a caption over 64 chars outright, and
    // icon + label can exceed it even when each part is individually valid.
    text: caption.slice(0, 64),
    ...(opts.callback ? { callback_data: opts.callback } : {}),
    ...(opts.url ? { url: opts.url } : {}),
    ...extras,
    ...(customEmojiId ? { icon_custom_emoji_id: customEmojiId } : {}),
  };
}

export function welcome(b: Branding, siteUrl: string): Screen {
  return {
    text:
      `${iconHtml(b, "logo")} <b>Courses Monster</b>\n\n` +
      "Your course library, directly on Telegram.\n\n" +
      "Browse the latest available courses below.",
    keyboard: [
      [btn(b, { label: "btn_browse", icon: "browse", callback: encode({ kind: "browse", page: 1 }) })],
      [btn(b, { label: "btn_search", icon: "search", callback: encode({ kind: "search", page: 1 }) })],
      [btn(b, { label: "btn_upcoming", icon: "upcoming", callback: encode({ kind: "upcoming", page: 1 }) })],
      [btn(b, { label: "btn_website", icon: "website", url: siteUrl })],
      [btn(b, { label: "btn_donate", icon: "donate", callback: "dn:menu" })],
    ],
  };
}

/** Shared prev / page-indicator / next row. Omitted entirely on a single page. */
function navRow(b: Branding, kind: "browse" | "search" | "upcoming", page: number, totalPages: number): InlineKeyboard {
  if (totalPages <= 1) return [];
  const row: InlineButton[] = [];
  if (page > 1) {
    row.push(btn(b, { label: "btn_prev", icon: "back", callback: encode({ kind, page: page - 1 }) }));
  }
  // A non-navigating label; it still needs valid callback_data, hence "noop".
  row.push({ text: `Page ${page}/${totalPages}`, callback_data: encode({ kind: "noop" }) });
  if (page < totalPages) {
    row.push(btn(b, { label: "btn_next", icon: "next", callback: encode({ kind, page: page + 1 }) }));
  }
  return [row];
}

function backRow(b: Branding): InlineKeyboard {
  return [[btn(b, { label: "btn_back", icon: "back", callback: encode({ kind: "home" }) })]];
}

function courseRows(
  b: Branding,
  items: BotCourse[],
  from: "browse" | "search" | "upcoming",
  page: number
): InlineKeyboard {
  // One course per row: long titles stay readable on a phone.
  return items.map((c, i) => [
    {
      text: clamp(`${i + 1}. ${c.title}`, 60),
      callback_data: encode({ kind: "course", courseId: c.id, from, page }),
    },
  ]);
}

export function browseList(b: Branding, result: Page): Screen {
  if (result.total === 0) {
    return {
      text: `${iconHtml(b, "browse")} <b>Available Courses</b>\n\nNo courses are published yet. Check back soon.`,
      keyboard: backRow(b),
    };
  }
  const lines = result.items.map((c, i) => `${i + 1}. ${esc(clamp(c.title, 70))}`).join("\n");
  return {
    text:
      `${iconHtml(b, "browse")} <b>Available Courses</b>\n\n${lines}\n\n` +
      `<i>${result.total} course${result.total === 1 ? "" : "s"} available</i>`,
    keyboard: [
      ...courseRows(b, result.items, "browse", result.page),
      ...navRow(b, "browse", result.page, result.totalPages),
      ...backRow(b),
    ],
  };
}

export function searchResults(b: Branding, query: string, result: Page): Screen {
  if (result.total === 0) {
    return {
      text:
        `${iconHtml(b, "search")} <b>Search</b>\n\nNo courses matched “${esc(clamp(query, 60))}”.\n\n` +
        "Try a different word, or browse the full catalog.",
      keyboard: [
        [btn(b, { label: "btn_browse", icon: "browse", callback: encode({ kind: "browse", page: 1 }) })],
        ...backRow(b),
      ],
    };
  }
  const lines = result.items.map((c, i) => `${i + 1}. ${esc(clamp(c.title, 70))}`).join("\n");
  return {
    text:
      `${iconHtml(b, "search")} <b>Results for “${esc(clamp(query, 50))}”</b>\n\n${lines}\n\n` +
      `<i>${result.total} match${result.total === 1 ? "" : "es"}</i>`,
    keyboard: [
      ...courseRows(b, result.items, "search", result.page),
      ...navRow(b, "search", result.page, result.totalPages),
      ...backRow(b),
    ],
  };
}

export function upcomingList(b: Branding, result: Page): Screen {
  if (result.total === 0) {
    return {
      text: `${iconHtml(b, "upcoming")} <b>No upcoming courses</b>\n\nNothing is scheduled right now — check back soon.`,
      keyboard: backRow(b),
    };
  }
  const lines = result.items
    .map((c, i) => {
      const when = c.availableAt ? DATE.format(c.availableAt) : "Date to be announced";
      const blurb = c.shortDescription ? `\n   ${esc(clamp(c.shortDescription, 90))}` : "";
      return `${i + 1}. <b>${esc(clamp(c.title, 70))}</b>\n   ${iconHtml(b, "date")} ${esc(when)}${blurb}`;
    })
    .join("\n\n");
  return {
    text: `${iconHtml(b, "upcoming")} <b>Upcoming Courses</b>\n\n${lines}`,
    keyboard: [
      ...courseRows(b, result.items, "upcoming", result.page),
      ...navRow(b, "upcoming", result.page, result.totalPages),
      ...backRow(b),
    ],
  };
}

export function courseDetail(
  b: Branding,
  course: BotCourse,
  ctx: { from: "browse" | "search" | "upcoming"; page: number; siteUrl: string; downloadable: boolean }
): Screen {
  const parts = [`${iconHtml(b, "logo")} <b>${esc(clamp(course.title, 120))}</b>`];

  const summary = course.shortDescription?.trim() || course.description?.trim();
  // Keep well under Telegram's 4096-char cap and don't dump a whole syllabus.
  if (summary) parts.push(`\n${iconHtml(b, "description")} ${esc(clamp(summary, 600))}`);

  if (course.category?.name) {
    parts.push(`\n${iconHtml(b, "category")} <b>Category:</b> ${esc(course.category.name)}`);
  }

  const facts: string[] = [];
  if (course.lecturesCount) facts.push(`${course.lecturesCount} lectures`);
  if (course.durationHours) facts.push(`${course.durationHours}h`);
  if (course.sizeLabel) facts.push(esc(course.sizeLabel));
  if (course.skillLevel) facts.push(esc(course.skillLevel.replace(/_/g, " ").toLowerCase()));
  if (course.language) facts.push(esc(course.language));
  if (facts.length) parts.push(`\n${iconHtml(b, "facts")} ${facts.join(" · ")}`);
  if (course.instructor) parts.push(`\n${iconHtml(b, "instructor")} ${esc(clamp(course.instructor, 60))}`);

  if (ctx.from === "upcoming" && course.availableAt) {
    parts.push(`\n${iconHtml(b, "date")} <b>Expected:</b> ${esc(DATE.format(course.availableAt))}`);
  } else {
    parts.push(`\n${iconHtml(b, "date")} <b>Updated:</b> ${esc(DATE.format(course.updatedAt))}`);
  }

  const keyboard: InlineKeyboard = [];
  if (ctx.downloadable) {
    keyboard.push([
      btn(b, { label: "btn_download", icon: "download", callback: encode({ kind: "download", courseId: course.id }) }),
    ]);
    keyboard.push([
      btn(b, { label: "btn_open_web", icon: "website", url: `${ctx.siteUrl}/courses/${course.slug}` }),
    ]);
  } else {
    parts.push("\n\n<i>Not released yet — you'll be able to download it once it's published.</i>");
  }
  keyboard.push([
    btn(b, { label: "btn_back_courses", icon: "back", callback: encode({ kind: ctx.from, page: ctx.page }) }),
  ]);

  return { text: parts.join("\n"), keyboard };
}

/**
 * The download hand-off. The bot never sends a file or a storage URL — it
 * sends the website's own protected download page, so the verification
 * gateway, captcha, rate limits and download logging all still apply.
 */
export function downloadHandoff(
  b: Branding,
  course: BotCourse,
  url: string,
  opts: { direct?: boolean; skipAdsUrl?: string } = {}
): Screen {
  // Premium members get a direct link (re-checked by the site when opened);
  // everyone else gets the steps page plus the offer to skip it.
  const text = opts.direct
    ? `👑 <b>${esc(clamp(course.title, 100))}</b>\n\n` +
      "You're Premium — no steps, no ads. Tap below to go straight to the download. The link works for 10 minutes."
    : `${iconHtml(b, "download")} <b>${esc(clamp(course.title, 100))}</b>\n\n` +
      "Tap below to open the protected download page on the website. " +
      "You'll pass the usual quick verification step there, then the download starts.";
  return {
    text,
    keyboard: [
      opts.direct
        ? [{ text: "⚡ Direct download", url, style: "success" }]
        : [btn(b, { label: "btn_continue", icon: "download", url })],
      ...(opts.skipAdsUrl && !opts.direct
        ? [[{ text: "👑 Skip ads – Get direct link with Premium", url: opts.skipAdsUrl }]]
        : []),
      [
        btn(b, {
          label: "btn_back",
          icon: "back",
          callback: encode({ kind: "course", courseId: course.id, from: "browse", page: 1 }),
        }),
      ],
    ],
  };
}

export function searchPrompt(b: Branding): Screen {
  return {
    text:
      `${iconHtml(b, "search")} <b>Search Courses</b>\n\n` +
      "Send me a word or two to search for — for example <code>python</code> or <code>system design</code>.",
    keyboard: backRow(b),
  };
}

export function help(b: Branding, siteUrl: string): Screen {
  return {
    text:
      `${iconHtml(b, "help")} <b>Help</b>\n\n` +
      "/start — main menu\n" +
      "/courses — browse the catalog\n" +
      "/search — search for a course\n" +
      "/upcoming — what's coming next\n" +
      "/website — open courses.monster\n" +
      "/help — this message\n\n" +
      "You can also just send me a word to search for it.",
    keyboard: [
      [btn(b, { label: "btn_browse", icon: "browse", callback: encode({ kind: "browse", page: 1 }) })],
      [btn(b, { label: "btn_website", icon: "website", url: siteUrl })],
    ],
  };
}

export function joinGate(b: Branding, channelUrl: string, retry: boolean): Screen {
  return {
    text: retry
      ? `${iconHtml(b, "channel")} <b>Not a member yet</b>\n\n` +
        "Please join the main channel first, then press Verify Membership again."
      : `${iconHtml(b, "channel")} <b>Join our main channel</b>\n\n` +
        "Access to the Course Library is available to channel members.\n\n" +
        "Please join our main channel first. It helps us keep the library organized " +
        "and lets you receive important course updates.",
    keyboard: [
      [btn(b, { label: "btn_join", icon: "channel", url: channelUrl })],
      [btn(b, { label: "btn_verify", icon: "verify", callback: "mb:v" })],
    ],
  };
}

export function membershipUnavailable(b: Branding, channelUrl: string): Screen {
  return {
    text:
      `${iconHtml(b, "warn")} <b>Membership verification is temporarily unavailable</b>\n\n` +
      "Please try again in a moment.",
    keyboard: [
      [btn(b, { label: "btn_join", icon: "channel", url: channelUrl })],
      [btn(b, { label: "btn_verify", icon: "verify", callback: "mb:v" })],
    ],
  };
}

export function donatePrompt(b: Branding, suggested: readonly number[]): Screen {
  const rows: InlineKeyboard = [];
  for (let i = 0; i < suggested.length; i += 3) {
    rows.push(
      suggested.slice(i, i + 3).map((n) => ({
        text: `${iconPlain(b, "stars")} ${n}`.slice(0, 64),
        callback_data: `dn:${n}`,
      }))
    );
  }
  rows.unshift([btn(b, { label: "btn_donate_one", icon: "stars", callback: "dn:1" })]);
  rows.push([btn(b, { label: "btn_donate_custom", icon: "edited", callback: "dn:c" })]);
  rows.push([btn(b, { label: "btn_back", icon: "back", callback: encode({ kind: "home" }) })]);
  return {
    text:
      `${iconHtml(b, "donate")} <b>Support Course Library</b>\n\n` +
      "This library takes time, infrastructure and maintenance to keep running.\n\n" +
      "If it has been useful to you and you genuinely want to support the project, " +
      "you can contribute any amount of Telegram Stars. Even 1 Star is completely " +
      "optional and appreciated.\n\n" +
      "Only donate if you genuinely want to support the project.\n\n" +
      "<i>Donations are voluntary. Please choose the amount carefully before confirming " +
      "payment — this bot does not provide a self-service refund option. " +
      "Use /paysupport if you need help with a payment.</i>",
    keyboard: rows,
  };
}

export function donateCustomPrompt(b: Branding, min: number, max: number): Screen {
  return {
    text:
      `${iconHtml(b, "stars")} <b>Custom amount</b>\n\n` +
      `Send the number of Stars you'd like to donate (${min}–${max.toLocaleString()}).\n` +
      "<i>Whole numbers only. /cancel to abort.</i>",
    keyboard: [[btn(b, { label: "btn_back", icon: "back", callback: "dn:menu" })]],
  };
}

export function donationThanks(b: Branding, amount: number): Screen {
  return {
    text:
      `${iconHtml(b, "donate")} <b>Donation received!</b>\n\n` +
      "Thank you for supporting the project.\n\n" +
      `Amount: ${iconHtml(b, "stars")} <b>${amount}</b> Stars\nTransaction recorded successfully.`,
    keyboard: [[btn(b, { label: "btn_back", icon: "back", callback: encode({ kind: "home" }) })]],
  };
}

export function paySupport(b: Branding, siteUrl: string): Screen {
  return {
    text:
      `${iconHtml(b, "support")} <b>Payment support</b>\n\n` +
      "Donations here are made with Telegram Stars and processed by Telegram.\n\n" +
      "If a payment failed, was taken twice, or your donation isn't showing, " +
      "reply to this chat describing what happened and roughly when. " +
      "Include the amount — that's enough for us to find the transaction.\n\n" +
      "Refunds are possible for completed Star payments. We'll confirm here once one is issued.",
    keyboard: [
      [btn(b, { label: "btn_website", icon: "website", url: siteUrl })],
      [btn(b, { label: "btn_back", icon: "back", callback: encode({ kind: "home" }) })],
    ],
  };
}

export function courseUnavailable(b: Branding): Screen {
  return {
    text: "This course is no longer available.",
    keyboard: [[btn(b, { label: "btn_browse", icon: "browse", callback: encode({ kind: "browse", page: 1 }) })]],
  };
}

export function errorMessage(b: Branding): Screen {
  return {
    text: `${iconHtml(b, "warn")} Something went wrong. Please try again.`,
    keyboard: [[btn(b, { label: "btn_retry", icon: "retry", callback: encode({ kind: "home" }) })]],
  };
}

/** Renders every screen against a branding snapshot — used by the admin preview. */
export const GENERIC_ERROR = "Something went wrong. Please try again.";
