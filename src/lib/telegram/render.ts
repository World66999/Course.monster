import type { InlineKeyboard } from "./api";
import { encode } from "./callback";
import type { BotCourse, Page } from "./catalog";

/**
 * Message builders. Everything user- or admin-supplied is HTML-escaped because
 * messages are sent with parse_mode: "HTML"; an unescaped "<" in a course
 * title would otherwise break the message or inject markup.
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

export function welcome(siteUrl: string): { text: string; keyboard: InlineKeyboard } {
  return {
    text:
      "🎓 <b>Courses Monster</b>\n\n" +
      "Your course library, directly on Telegram.\n\n" +
      "Browse the latest available courses below.",
    keyboard: [
      [{ text: "📚 Browse Courses", callback_data: encode({ kind: "browse", page: 1 }) }],
      [{ text: "🔎 Search Courses", callback_data: encode({ kind: "search", page: 1 }) }],
      [{ text: "🚀 Upcoming", callback_data: encode({ kind: "upcoming", page: 1 }) }],
      [{ text: "🌐 Open Website", url: siteUrl }],
    ],
  };
}

/** Shared prev / page-indicator / next row. Omitted entirely on a single page. */
function navRow(kind: "browse" | "search" | "upcoming", page: number, totalPages: number): InlineKeyboard {
  if (totalPages <= 1) return [];
  const row = [];
  if (page > 1) row.push({ text: "◀️ Previous", callback_data: encode({ kind, page: page - 1 }) });
  // A non-navigating label; it still needs valid callback_data, hence "noop".
  row.push({ text: `Page ${page}/${totalPages}`, callback_data: encode({ kind: "noop" }) });
  if (page < totalPages) row.push({ text: "Next ▶️", callback_data: encode({ kind, page: page + 1 }) });
  return [row];
}

function courseRows(items: BotCourse[], from: "browse" | "search" | "upcoming", page: number): InlineKeyboard {
  // One course per row: long titles stay readable on a phone.
  return items.map((c, i) => [
    {
      text: clamp(`${i + 1}. ${c.title}`, 60),
      callback_data: encode({ kind: "course", courseId: c.id, from, page }),
    },
  ]);
}

export function browseList(result: Page): { text: string; keyboard: InlineKeyboard } {
  if (result.total === 0) {
    return {
      text: "📚 <b>Available Courses</b>\n\nNo courses are published yet. Check back soon.",
      keyboard: [[{ text: "◀️ Back", callback_data: encode({ kind: "home" }) }]],
    };
  }
  const lines = result.items.map((c, i) => `${i + 1}. ${esc(clamp(c.title, 70))}`).join("\n");
  return {
    text: `📚 <b>Available Courses</b>\n\n${lines}\n\n<i>${result.total} course${result.total === 1 ? "" : "s"} available</i>`,
    keyboard: [
      ...courseRows(result.items, "browse", result.page),
      ...navRow("browse", result.page, result.totalPages),
      [{ text: "◀️ Back", callback_data: encode({ kind: "home" }) }],
    ],
  };
}

export function searchResults(query: string, result: Page): { text: string; keyboard: InlineKeyboard } {
  if (result.total === 0) {
    return {
      text: `🔎 <b>Search</b>\n\nNo courses matched “${esc(clamp(query, 60))}”.\n\nTry a different word, or browse the full catalog.`,
      keyboard: [
        [{ text: "📚 Browse Courses", callback_data: encode({ kind: "browse", page: 1 }) }],
        [{ text: "◀️ Back", callback_data: encode({ kind: "home" }) }],
      ],
    };
  }
  const lines = result.items.map((c, i) => `${i + 1}. ${esc(clamp(c.title, 70))}`).join("\n");
  return {
    text: `🔎 <b>Results for “${esc(clamp(query, 50))}”</b>\n\n${lines}\n\n<i>${result.total} match${result.total === 1 ? "" : "es"}</i>`,
    keyboard: [
      ...courseRows(result.items, "search", result.page),
      ...navRow("search", result.page, result.totalPages),
      [{ text: "◀️ Back", callback_data: encode({ kind: "home" }) }],
    ],
  };
}

export function upcomingList(result: Page): { text: string; keyboard: InlineKeyboard } {
  if (result.total === 0) {
    return {
      text: "🚀 <b>No upcoming courses</b>\n\nNothing is scheduled right now — check back soon.",
      keyboard: [[{ text: "◀️ Back", callback_data: encode({ kind: "home" }) }]],
    };
  }
  const lines = result.items
    .map((c, i) => {
      const when = c.availableAt ? DATE.format(c.availableAt) : "Date to be announced";
      const blurb = c.shortDescription ? `\n   ${esc(clamp(c.shortDescription, 90))}` : "";
      return `${i + 1}. <b>${esc(clamp(c.title, 70))}</b>\n   📅 ${esc(when)}${blurb}`;
    })
    .join("\n\n");
  return {
    text: `🚀 <b>Upcoming Courses</b>\n\n${lines}`,
    keyboard: [
      ...courseRows(result.items, "upcoming", result.page),
      ...navRow("upcoming", result.page, result.totalPages),
      [{ text: "◀️ Back", callback_data: encode({ kind: "home" }) }],
    ],
  };
}

export function courseDetail(
  course: BotCourse,
  ctx: { from: "browse" | "search" | "upcoming"; page: number; siteUrl: string; downloadable: boolean }
): { text: string; keyboard: InlineKeyboard } {
  const parts = [`🎓 <b>${esc(clamp(course.title, 120))}</b>`];

  const summary = course.shortDescription?.trim() || course.description?.trim();
  // Keep well under Telegram's 4096-char cap and don't dump a whole syllabus.
  if (summary) parts.push(`\n📝 ${esc(clamp(summary, 600))}`);

  if (course.category?.name) parts.push(`\n🏷 <b>Category:</b> ${esc(course.category.name)}`);

  const facts: string[] = [];
  if (course.lecturesCount) facts.push(`${course.lecturesCount} lectures`);
  if (course.durationHours) facts.push(`${course.durationHours}h`);
  if (course.sizeLabel) facts.push(esc(course.sizeLabel));
  if (course.skillLevel) facts.push(esc(course.skillLevel.replace(/_/g, " ").toLowerCase()));
  if (course.language) facts.push(esc(course.language));
  if (facts.length) parts.push(`\n📚 ${facts.join(" · ")}`);
  if (course.instructor) parts.push(`\n👤 ${esc(clamp(course.instructor, 60))}`);

  if (ctx.from === "upcoming" && course.availableAt) {
    parts.push(`\n📅 <b>Expected:</b> ${esc(DATE.format(course.availableAt))}`);
  } else {
    parts.push(`\n📅 <b>Updated:</b> ${esc(DATE.format(course.updatedAt))}`);
  }

  const keyboard: InlineKeyboard = [];
  if (ctx.downloadable) {
    keyboard.push([{ text: "⬇️ Download Course", callback_data: encode({ kind: "download", courseId: course.id }) }]);
    keyboard.push([{ text: "🌐 Open on Website", url: `${ctx.siteUrl}/courses/${course.slug}` }]);
  } else {
    parts.push("\n\n<i>Not released yet — you'll be able to download it once it's published.</i>");
  }
  keyboard.push([{ text: "◀️ Back to Courses", callback_data: encode({ kind: ctx.from, page: ctx.page }) }]);

  return { text: parts.join("\n"), keyboard };
}

/**
 * The download hand-off. The bot never sends a file or a storage URL — it
 * sends the website's own protected download page, so the verification
 * gateway, captcha, rate limits and download logging all still apply.
 */
export function downloadHandoff(course: BotCourse, url: string): { text: string; keyboard: InlineKeyboard } {
  return {
    text:
      `⬇️ <b>${esc(clamp(course.title, 100))}</b>\n\n` +
      "Tap below to open the protected download page on the website. " +
      "You'll pass the usual quick verification step there, then the download starts.",
    keyboard: [
      [{ text: "⬇️ Continue to download", url }],
      [{ text: "◀️ Back", callback_data: encode({ kind: "course", courseId: course.id, from: "browse", page: 1 }) }],
    ],
  };
}

export function searchPrompt(): { text: string; keyboard: InlineKeyboard } {
  return {
    text: "🔎 <b>Search Courses</b>\n\nSend me a word or two to search for — for example <code>python</code> or <code>system design</code>.",
    keyboard: [[{ text: "◀️ Back", callback_data: encode({ kind: "home" }) }]],
  };
}

export function help(siteUrl: string): { text: string; keyboard: InlineKeyboard } {
  return {
    text:
      "❓ <b>Help</b>\n\n" +
      "/start — main menu\n" +
      "/courses — browse the catalog\n" +
      "/search — search for a course\n" +
      "/upcoming — what's coming next\n" +
      "/website — open courses.monster\n" +
      "/help — this message\n\n" +
      "You can also just send me a word to search for it.",
    keyboard: [
      [{ text: "📚 Browse Courses", callback_data: encode({ kind: "browse", page: 1 }) }],
      [{ text: "🌐 Open Website", url: siteUrl }],
    ],
  };
}

export const GENERIC_ERROR = "⚠️ Something went wrong. Please try again.";

export function errorMessage(): { text: string; keyboard: InlineKeyboard } {
  return {
    text: GENERIC_ERROR,
    keyboard: [[{ text: "🔄 Try again", callback_data: encode({ kind: "home" }) }]],
  };
}
