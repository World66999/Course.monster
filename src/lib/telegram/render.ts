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
export function downloadHandoff(b: Branding, course: BotCourse, url: string): Screen {
  return {
    text:
      `${iconHtml(b, "download")} <b>${esc(clamp(course.title, 100))}</b>\n\n` +
      "Tap below to open the protected download page on the website. " +
      "You'll pass the usual quick verification step there, then the download starts.",
    keyboard: [
      [btn(b, { label: "btn_continue", icon: "download", url })],
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

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  newToday: number;
  publishedCourses: number;
  downloadRequests: number;
  completedDownloads: number;
  pendingUpdates: number | null;
  lastWebhookError: string | null;
}

/**
 * Admin-only status screen.
 *
 * Deliberately read-only, and deliberately does NOT contain a link to the web
 * admin panel: that path is a secret, and a Telegram message can be forwarded,
 * screenshotted or synced to another device. Management stays on the website.
 */
export function adminPanel(b: Branding, stats: AdminStats, siteUrl: string): Screen {
  const lines = [
    "👮 <b>Bot Admin</b>",
    "",
    `👥 Users: <b>${stats.totalUsers}</b> · active 7d <b>${stats.activeUsers}</b> · new today <b>${stats.newToday}</b>`,
    `${iconHtml(b, "browse")} Published courses: <b>${stats.publishedCourses}</b>`,
    `${iconHtml(b, "download")} Download requests: <b>${stats.downloadRequests}</b> · completed <b>${stats.completedDownloads}</b>`,
  ];
  if (stats.pendingUpdates !== null) {
    lines.push(`🔌 Webhook queue: <b>${stats.pendingUpdates}</b>`);
  }
  lines.push(
    stats.lastWebhookError
      ? `${iconHtml(b, "warn")} Last webhook error: ${esc(clamp(stats.lastWebhookError, 120))}`
      : "✅ No recent webhook errors"
  );
  lines.push("", "<i>Icons, labels, broadcasts and users are managed on the website.</i>");

  return {
    text: lines.join("\n"),
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
