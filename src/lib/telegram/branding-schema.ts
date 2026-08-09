import { z } from "zod";

/**
 * Canonical definition of every customisable icon, button label and button
 * style used by the Telegram bot.
 *
 * This is the single source of truth: `render.ts` reads every emoji and every
 * button caption through the helpers below, so there is no second place where
 * a label is hard-coded. Metadata (default, human name, where it appears) lives
 * next to the value so the admin UI can explain each entry without a parallel
 * list to keep in sync.
 *
 * Ported from Bot5's ICON_META / BUTTON_META tables. One deliberate divergence:
 * Bot5 stores the emoji *inside* the label string ("➕ Add to Group"), which
 * means its Icon Manager and Button Label Manager fight over the same text.
 * Here icon and caption are separate fields and composed at render time, so
 * each manager owns exactly one thing.
 */

export interface IconMeta {
  default: string;
  name: string;
  where: string;
}

export const ICON_META = {
  logo: { default: "🎓", name: "Brand mark", where: "Welcome header, course titles" },
  browse: { default: "📚", name: "Browse / Catalog", where: "Browse button, course list header" },
  search: { default: "🔎", name: "Search", where: "Search button, results header" },
  upcoming: { default: "🚀", name: "Upcoming", where: "Upcoming button and header" },
  website: { default: "🌐", name: "Website", where: "Open Website / Open on Website buttons" },
  download: { default: "⬇️", name: "Download", where: "Download button, hand-off screen" },
  back: { default: "◀️", name: "Back arrow", where: "Back and Previous buttons" },
  next: { default: "▶️", name: "Forward arrow", where: "Next page button" },
  help: { default: "❓", name: "Help", where: "Help screen title" },
  warn: { default: "⚠️", name: "Warning", where: "Error messages" },
  retry: { default: "🔄", name: "Retry", where: "Try again button" },
  description: { default: "📝", name: "Description", where: "Course detail description line" },
  category: { default: "🏷", name: "Category", where: "Course detail category line" },
  facts: { default: "📚", name: "Course facts", where: "Lectures / duration / size line" },
  instructor: { default: "👤", name: "Instructor", where: "Course detail instructor line" },
  date: { default: "📅", name: "Calendar", where: "Updated and expected dates" },

  // Admin panel. Editable too, so no emoji anywhere in the bot is hard-coded.
  admin: { default: "👮", name: "Admin shield", where: "Admin panel title" },
  dashboard: { default: "📊", name: "Dashboard", where: "Admin: Dashboard button and title" },
  broadcast: { default: "📡", name: "Broadcast", where: "Admin: Broadcast button and title" },
  dm: { default: "✉️", name: "Direct message", where: "Admin: DM User button" },
  trophy: { default: "🏆", name: "Trophy", where: "Admin: Top Courses" },
  list: { default: "📋", name: "List", where: "Admin: Recent Users" },
  export: { default: "📤", name: "Export / Upload", where: "Admin: Export Data, send prompts" },
  palette: { default: "🎨", name: "Palette", where: "Admin: Icon Manager" },
  buttons: { default: "🔘", name: "Button", where: "Admin: Button Labels" },
  brush: { default: "🖌️", name: "Brush", where: "Admin: Button Style" },
  reset: { default: "♻️", name: "Reset", where: "Admin: reset actions" },
  close: { default: "❌", name: "Close / Cancel", where: "Admin: Close, cancelled messages" },
  users: { default: "👥", name: "Users", where: "Admin: user counts" },
  newBadge: { default: "🆕", name: "New badge", where: "Admin: new users today" },
  blocked: { default: "🚫", name: "Blocked", where: "Admin: blocked users" },
  views: { default: "👁", name: "Views", where: "Admin: course view counts" },
  trend: { default: "📈", name: "Trend", where: "Admin: conversion rates" },
  webhook: { default: "🔌", name: "Webhook", where: "Admin: webhook queue" },
  ok: { default: "✅", name: "Success tick", where: "Admin: confirmations, healthy status" },
  target: { default: "🎯", name: "Target", where: "Admin: DM target locked" },
  edited: { default: "✏️", name: "Edited marker", where: "Admin: customised entries" },
  premium: { default: "✨", name: "Premium sparkle", where: "Admin: premium emoji marker" },
  sleeping: { default: "💤", name: "Dormant", where: "Admin: users who blocked the bot" },
  dotPrimary: { default: "🔵", name: "Blue dot", where: "Admin: primary colour marker" },
  dotSuccess: { default: "🟢", name: "Green dot", where: "Admin: success colour marker" },
  dotDanger: { default: "🔴", name: "Red dot", where: "Admin: danger colour marker" },
} as const satisfies Record<string, IconMeta>;

export type IconKey = keyof typeof ICON_META;
export const ICON_KEYS = Object.keys(ICON_META) as IconKey[];

export interface LabelMeta {
  default: string;
  where: string;
}

export const LABEL_META = {
  btn_browse: { default: "Browse Courses", where: "Main menu" },
  btn_search: { default: "Search Courses", where: "Main menu" },
  btn_upcoming: { default: "Upcoming", where: "Main menu" },
  btn_website: { default: "Open Website", where: "Main menu, help screen" },
  btn_download: { default: "Download Course", where: "Course detail" },
  btn_open_web: { default: "Open on Website", where: "Course detail" },
  btn_back_courses: { default: "Back to Courses", where: "Course detail" },
  btn_back: { default: "Back", where: "List screens, download hand-off" },
  btn_prev: { default: "Previous", where: "Pagination row" },
  btn_next: { default: "Next", where: "Pagination row" },
  btn_continue: { default: "Continue to download", where: "Download hand-off" },
  btn_retry: { default: "Try again", where: "Error screen" },
} as const satisfies Record<string, LabelMeta>;

export type LabelKey = keyof typeof LABEL_META;
export const LABEL_KEYS = Object.keys(LABEL_META) as LabelKey[];

/**
 * Telegram's own button styles (Bot API `InlineKeyboardButton.style`): exactly
 * "primary", "success" or "danger". "none" is our sentinel for "send no style
 * field at all", which lets Telegram apply its app-specific default.
 */
export const BUTTON_STYLES = {
  none: "Default (app style)",
  primary: "Primary (blue)",
  success: "Success (green)",
  danger: "Danger (red)",
} as const;

export type ButtonStyle = keyof typeof BUTTON_STYLES;
export const BUTTON_STYLE_KEYS = Object.keys(BUTTON_STYLES) as ButtonStyle[];

/** Telegram caps button text at 64 characters. */
export const MAX_LABEL_LENGTH = 64;
/** A generous bound for an emoji; also stops a whole message being pasted in. */
export const MAX_ICON_LENGTH = 16;

/**
 * A premium (custom) emoji. `char` is the plain fallback shown wherever the
 * custom emoji cannot be rendered — Telegram requires a real emoji there.
 */
const premiumIconSchema = z.object({
  premiumId: z.string().regex(/^\d{1,32}$/, "Custom emoji id must be numeric"),
  char: z.string().min(1).max(MAX_ICON_LENGTH),
  /** Sticker set the id came from, for the admin's Source column. */
  set: z.string().max(64).optional(),
  /** True when assigned by the library rather than chosen by hand. */
  auto: z.boolean().optional(),
  /** Last time Telegram confirmed the id resolves (epoch ms). */
  verifiedAt: z.number().int().optional(),
});

/** Either a plain emoji string or a premium custom emoji. */
export const iconValueSchema = z.union([
  z.string().min(1, "Icon cannot be empty").max(MAX_ICON_LENGTH, `Max ${MAX_ICON_LENGTH} characters`),
  premiumIconSchema,
]);
export type IconValue = z.infer<typeof iconValueSchema>;

export const labelValueSchema = z.object({
  text: z.string().trim().min(1, "Label cannot be empty").max(MAX_LABEL_LENGTH, `Max ${MAX_LABEL_LENGTH} characters`),
  style: z.enum(["none", "primary", "success", "danger"]).optional(),
  /** Per-button premium icon (Telegram's `icon_custom_emoji_id`). */
  iconId: z.string().regex(/^\d{1,32}$/).optional(),
});
export type LabelValue = z.infer<typeof labelValueSchema>;

/**
 * Stored shape. Records are open (`z.record`) rather than keyed to the enums so
 * that removing a key from the tables above can never make an existing stored
 * blob fail validation — unknown keys are simply ignored on read.
 */
export const brandingSchema = z.object({
  icons: z.record(z.string(), iconValueSchema).default({}),
  labels: z.record(z.string(), labelValueSchema).default({}),
  defaultStyle: z.enum(["none", "primary", "success", "danger"]).default("none"),
});
export type Branding = z.infer<typeof brandingSchema>;

export const BRANDING_KEY = "telegram-branding";

/** Nothing customised: every lookup falls through to the tables above. */
export const defaultBranding: Branding = { icons: {}, labels: {}, defaultStyle: "none" };

function isPremium(value: IconValue | undefined): value is { premiumId: string; char: string } {
  return typeof value === "object" && value !== null && "premiumId" in value;
}

/**
 * Icon for use inside message text (parse_mode HTML). A premium icon becomes a
 * `<tg-emoji>` tag whose body is the plain fallback, exactly as Telegram
 * documents. Unknown or malformed keys fall back to the default.
 */
export function iconHtml(branding: Branding, key: IconKey): string {
  const value = branding.icons[key];
  if (isPremium(value)) {
    return `<tg-emoji emoji-id="${value.premiumId}">${value.char}</tg-emoji>`;
  }
  if (typeof value === "string" && value.length > 0) return value;
  return ICON_META[key].default;
}

/**
 * Icon for use in a button caption, which is plain text — a `<tg-emoji>` tag
 * would be shown literally there, so a premium icon degrades to its fallback
 * character (the per-button `iconId` is how a button gets a real custom emoji).
 */
export function iconPlain(branding: Branding, key: IconKey): string {
  const value = branding.icons[key];
  if (isPremium(value)) return value.char;
  if (typeof value === "string" && value.length > 0) return value;
  return ICON_META[key].default;
}

export function isPremiumIcon(branding: Branding, key: IconKey): boolean {
  return isPremium(branding.icons[key]);
}

/**
 * Custom-emoji id for an icon, or null when it's a plain emoji.
 *
 * Button captions are plain text, so a `<tg-emoji>` tag would be shown
 * literally there. The only way a premium icon can appear on a button is
 * Telegram's `icon_custom_emoji_id` field — this is what feeds it.
 */
export function premiumIconId(branding: Branding, key: IconKey): string | null {
  const value = branding.icons[key];
  return isPremium(value) ? value.premiumId : null;
}

/** Button caption text, without any icon. */
export function labelText(branding: Branding, key: LabelKey): string {
  const value = branding.labels[key];
  const text = value?.text?.trim();
  return text && text.length > 0 ? text : LABEL_META[key].default;
}

/**
 * Telegram-side presentation for a button: the resolved style (per-button
 * override, else the global default) and any per-button premium icon.
 */
export function buttonExtras(
  branding: Branding,
  key: LabelKey
): { style?: Exclude<ButtonStyle, "none">; icon_custom_emoji_id?: string } {
  const value = branding.labels[key];
  const style = value?.style ?? branding.defaultStyle;
  return {
    ...(style && style !== "none" ? { style } : {}),
    ...(value?.iconId ? { icon_custom_emoji_id: value.iconId } : {}),
  };
}

export function buttonStyleOf(branding: Branding, key: LabelKey): ButtonStyle {
  return branding.labels[key]?.style ?? branding.defaultStyle;
}

/** True when the entry differs from its shipped default (drives "Reset"). */
export function isIconCustomised(branding: Branding, key: IconKey): boolean {
  return branding.icons[key] !== undefined;
}
export function isLabelCustomised(branding: Branding, key: LabelKey): boolean {
  return branding.labels[key] !== undefined;
}
