import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { answerCallbackQuery, editMessageText, sendMessage, type InlineKeyboard } from "./api";
import { getBranding, readBrandingFresh, saveBranding } from "./branding";
import {
  BUTTON_STYLES,
  BUTTON_STYLE_KEYS,
  ICON_KEYS,
  ICON_META,
  LABEL_KEYS,
  LABEL_META,
  MAX_ICON_LENGTH,
  MAX_LABEL_LENGTH,
  brandingSchema,
  buttonStyleOf,
  iconPlain,
  type Branding,
  isIconCustomised,
  isLabelCustomised,
  labelText,
  type ButtonStyle,
  type IconKey,
  type LabelKey,
} from "./branding-schema";
import { getMostDownloadedCourses, getMostRequestedCourses, getOverview } from "./analytics";
import { queueBroadcast, runBroadcast } from "./broadcast";
import { getWebhookInfo } from "./api";
import { esc } from "./render";
import { isBotAdmin, siteUrl } from "./config";

/**
 * In-Telegram admin panel, mirroring Bot5's inline-keyboard panel.
 *
 * It is a second *surface*, never a second system: icons/labels/style write the
 * same `Setting` row the website's Appearance page uses, broadcasts go through
 * the same resumable engine, and user blocking flips the same column. Whatever
 * you change here shows up there, and vice versa.
 *
 * Every entry point re-checks the admin id server-side. Callback data is
 * attacker-controlled, so being able to *name* an admin action is never
 * sufficient to perform one.
 */

const PAGE = 8;
type Screen = { text: string; keyboard: InlineKeyboard };

/**
 * Plain icon accessor. Every emoji the admin panel prints goes through here so
 * the Icon Manager governs the whole bot, admin screens included — there is no
 * literal emoji left in this file's output.
 */
const I = (b: Branding, key: IconKey): string => iconPlain(b, key);

/** Pending multi-step input, persisted on the TelegramUser row. */
export type AdminState =
  | { mode: "icon"; key: string }
  | { mode: "label"; key: string }
  | { mode: "broadcast" }
  | { mode: "dm-id" }
  | { mode: "dm-text"; target: string };

export function parseAdminState(value: unknown): AdminState | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  switch (v.mode) {
    case "icon":
    case "label":
      return typeof v.key === "string" ? ({ mode: v.mode, key: v.key } as AdminState) : null;
    case "broadcast":
      return { mode: "broadcast" };
    case "dm-id":
      return { mode: "dm-id" };
    case "dm-text":
      return typeof v.target === "string" ? { mode: "dm-text", target: v.target } : null;
    default:
      return null;
  }
}

async function setState(userId: string, state: AdminState | null): Promise<void> {
  // Prisma reads `undefined` as "leave this column alone", so clearing a Json?
  // column needs Prisma.DbNull. Using `?? undefined` here silently never
  // cleared the state, stranding the admin in edit mode forever.
  await db.telegramUser.update({
    where: { id: userId },
    data: { adminState: state === null ? Prisma.DbNull : state },
  });
}

/** Compact callback vocabulary — everything stays far inside 64 bytes. */
export type AdminCallback =
  | { k: "home" } | { k: "stats" } | { k: "close" } | { k: "export" }
  | { k: "icons"; page: number } | { k: "icon"; key: string } | { k: "iconReset"; key: string }
  | { k: "labels"; page: number } | { k: "label"; key: string } | { k: "labelReset"; key: string }
  | { k: "labelColor"; key: string; color: ButtonStyle }
  | { k: "style" } | { k: "styleSet"; value: ButtonStyle }
  | { k: "resetAll" } | { k: "resetAllGo" }
  | { k: "broadcast" } | { k: "broadcastGo" }
  | { k: "dm" }
  | { k: "top"; page: number } | { k: "users"; page: number } | { k: "userBlock"; id: string };

const KEY_RE = /^[a-z_]{1,32}$/;
const CUID_RE = /^c[a-z0-9]{20,30}$/;
const PAGE_RE = /^\d{1,4}$/;

export function decodeAdmin(raw: string): AdminCallback | null {
  if (!raw.startsWith("a:") || Buffer.byteLength(raw, "utf8") > 64) return null;
  const [, op, arg, arg2] = raw.split(":");
  const page = () => (arg && PAGE_RE.test(arg) ? Math.min(Number(arg), 9999) : null);
  switch (op) {
    case "home": return { k: "home" };
    case "stats": return { k: "stats" };
    case "close": return { k: "close" };
    case "exp": return { k: "export" };
    case "style": return { k: "style" };
    case "bc": return { k: "broadcast" };
    case "bcgo": return { k: "broadcastGo" };
    case "dm": return { k: "dm" };
    case "ra": return { k: "resetAll" };
    case "rago": return { k: "resetAllGo" };
    case "icons": { const p = page(); return p === null ? null : { k: "icons", page: p }; }
    case "labels": { const p = page(); return p === null ? null : { k: "labels", page: p }; }
    case "top": { const p = page(); return p === null ? null : { k: "top", page: p }; }
    case "users": { const p = page(); return p === null ? null : { k: "users", page: p }; }
    case "ic": return arg && KEY_RE.test(arg) ? { k: "icon", key: arg } : null;
    case "icr": return arg && KEY_RE.test(arg) ? { k: "iconReset", key: arg } : null;
    case "bt": return arg && KEY_RE.test(arg) ? { k: "label", key: arg } : null;
    case "btr": return arg && KEY_RE.test(arg) ? { k: "labelReset", key: arg } : null;
    case "btc":
      return arg && KEY_RE.test(arg) && arg2 && (BUTTON_STYLE_KEYS as string[]).includes(arg2)
        ? { k: "labelColor", key: arg, color: arg2 as ButtonStyle }
        : null;
    case "sty":
      return arg && (BUTTON_STYLE_KEYS as string[]).includes(arg) ? { k: "styleSet", value: arg as ButtonStyle } : null;
    case "ub": return arg && CUID_RE.test(arg) ? { k: "userBlock", id: arg } : null;
    default: return null;
  }
}

const back = (b: Branding, to = "a:home"): InlineKeyboard => [[{ text: `${I(b, "back")} Back`, callback_data: to }]];

function pager(b: Branding, prefix: string, page: number, totalPages: number): InlineKeyboard {
  if (totalPages <= 1) return [];
  const row = [];
  if (page > 0) row.push({ text: I(b, "back"), callback_data: `${prefix}:${page - 1}` });
  row.push({ text: `${page + 1}/${totalPages}`, callback_data: "a:noop" });
  if (page < totalPages - 1) row.push({ text: I(b, "next"), callback_data: `${prefix}:${page + 1}` });
  return [row];
}

// ── screens ────────────────────────────────────────────────────────────

async function homeScreen(snapshot?: Branding): Promise<Screen> {
  const [b, users, courses] = await Promise.all([
    snapshot ? Promise.resolve(snapshot) : getBranding(),
    db.telegramUser.count(),
    db.course.count({ where: { published: true } }),
  ]);
  return {
    text:
      `${I(b, "admin")} <b>Admin Panel</b>\n\n` +
      `${I(b, "users")} Users: <code>${users}</code>\n` +
      `${I(b, "browse")} Published courses: <code>${courses}</code>\n\n` +
      `Select an action:`,
    keyboard: [
      [{ text: `${I(b, "dashboard")} Dashboard`, callback_data: "a:stats" }, { text: `${I(b, "broadcast")} Broadcast`, callback_data: "a:bc" }],
      [{ text: `${I(b, "dm")} DM User`, callback_data: "a:dm" }, { text: `${I(b, "trophy")} Top Courses`, callback_data: "a:top:0" }],
      [{ text: `${I(b, "list")} Recent Users`, callback_data: "a:users:0" }, { text: `${I(b, "export")} Export Data`, callback_data: "a:exp" }],
      [{ text: `${I(b, "palette")} Icon Manager`, callback_data: "a:icons:0" }, { text: `${I(b, "buttons")} Button Labels`, callback_data: "a:labels:0" }],
      [{ text: `${I(b, "brush")} Button Style`, callback_data: "a:style" }],
      [{ text: `${I(b, "reset")} Reset appearance`, callback_data: "a:ra" }],
      [{ text: `${I(b, "close")} Close`, callback_data: "a:close" }],
    ],
  };
}

async function statsScreen(snapshot?: Branding): Promise<Screen> {
  const [b, o, courses, webhook] = await Promise.all([
    snapshot ? Promise.resolve(snapshot) : getBranding(),
    getOverview(),
    db.course.count({ where: { published: true } }),
    getWebhookInfo(),
  ]);
  const lines = [
    `${I(b, "dashboard")} <b>Dashboard</b>`,
    "",
    `${I(b, "users")} Users <b>${o.totalUsers}</b> · active 7d <b>${o.activeUsers}</b>`,
    `${I(b, "newBadge")} New today <b>${o.newToday}</b> · this week <b>${o.newThisWeek}</b>`,
    `${I(b, "blocked")} Blocked <b>${o.blockedUsers}</b>`,
    "",
    `${I(b, "browse")} Published courses <b>${courses}</b>`,
    `${I(b, "views")} Course views <b>${o.courseViews}</b> · searches <b>${o.searches}</b>`,
    `${I(b, "download")} Requested <b>${o.downloadRequests}</b> · completed <b>${o.completedDownloads}</b>`,
    `${I(b, "trend")} View→request <b>${o.viewToRequestRate}%</b> · request→done <b>${o.requestToDownloadRate}%</b>`,
    "",
    webhook.ok
      ? `${I(b, "webhook")} Webhook queue <b>${webhook.result.pending_update_count}</b>` +
        (webhook.result.last_error_message
          ? `\n${I(b, "warn")} ${esc(webhook.result.last_error_message.slice(0, 100))}`
          : `\n${I(b, "ok")} No webhook errors`)
      : `${I(b, "warn")} Telegram unreachable`,
  ];
  return { text: lines.join("\n"), keyboard: back(b) };
}

async function iconsScreen(page: number, snapshot?: Branding): Promise<Screen> {
  const b = snapshot ?? (await getBranding());
  const totalPages = Math.ceil(ICON_KEYS.length / PAGE);
  const safe = Math.min(page, totalPages - 1);
  const slice = ICON_KEYS.slice(safe * PAGE, safe * PAGE + PAGE);
  const custom = ICON_KEYS.filter((k) => isIconCustomised(b, k)).length;
  return {
    text:
      `${I(b, "palette")} <b>Icon Manager</b>\n\n` +
      `Total <b>${ICON_KEYS.length}</b> · customised <b>${custom}</b>\n\n` +
      `Tap an icon to change it. Send a normal or premium emoji after tapping.`,
    keyboard: [
      ...slice.map((k) => [
        {
          text: `${iconPlain(b, k)}  ${ICON_META[k].name}${isIconCustomised(b, k) ? " " + I(b, "edited") : ""}`.slice(0, 64),
          callback_data: `a:ic:${k}`,
        },
      ]),
      ...pager(b, "a:icons", safe, totalPages),
      ...back(b),
    ],
  };
}

async function iconEditScreen(key: IconKey, snapshot?: Branding): Promise<Screen> {
  const b = snapshot ?? (await getBranding());
  const meta = ICON_META[key];
  return {
    text:
      `${I(b, "palette")} <b>${esc(meta.name)}</b>\n\n` +
      `Current: ${iconPlain(b, key)}\nDefault: ${meta.default}\n` +
      `<i>Used in: ${esc(meta.where)}</i>\n\n` +
      `${I(b, "export")} Send a new emoji now (max ${MAX_ICON_LENGTH} chars).\n<i>/cancel to abort.</i>`,
    keyboard: [
      ...(isIconCustomised(b, key) ? [[{ text: `${I(b, "reset")} Reset to default`, callback_data: `a:icr:${key}` }]] : []),
      [{ text: `${I(b, "back")} Back to icons`, callback_data: "a:icons:0" }],
    ],
  };
}

async function labelsScreen(page: number, snapshot?: Branding): Promise<Screen> {
  const b = snapshot ?? (await getBranding());
  const totalPages = Math.ceil(LABEL_KEYS.length / PAGE);
  const safe = Math.min(page, totalPages - 1);
  const slice = LABEL_KEYS.slice(safe * PAGE, safe * PAGE + PAGE);
  const dot: Record<ButtonStyle, string> = {
    none: "",
    primary: " " + I(b, "dotPrimary"),
    success: " " + I(b, "dotSuccess"),
    danger: " " + I(b, "dotDanger"),
  };
  return {
    text: `${I(b, "buttons")} <b>Button Labels</b>\n\nTap a button to change its text or colour.\n<i>Max ${MAX_LABEL_LENGTH} characters.</i>`,
    keyboard: [
      ...slice.map((k) => [
        {
          text: `${labelText(b, k)}${dot[buttonStyleOf(b, k)]}${isLabelCustomised(b, k) ? " " + I(b, "edited") : ""}`.slice(0, 64),
          callback_data: `a:bt:${k}`,
        },
      ]),
      ...pager(b, "a:labels", safe, totalPages),
      ...back(b),
    ],
  };
}

async function labelEditScreen(key: LabelKey, flash = "", snapshot?: Branding): Promise<Screen> {
  const b = snapshot ?? (await getBranding());
  const meta = LABEL_META[key];
  const current = buttonStyleOf(b, key);
  return {
    text:
      (flash ? `${flash}\n\n` : "") +
      `${I(b, "buttons")} <b>${esc(meta.where)}</b>\n\n` +
      `Label: <code>${esc(labelText(b, key))}</code>\nDefault: <code>${esc(meta.default)}</code>\n` +
      `Colour: <b>${BUTTON_STYLES[current]}</b>\n\n` +
      `${I(b, "export")} Send new text (max ${MAX_LABEL_LENGTH}), or pick a colour below.\n<i>/cancel to abort.</i>`,
    keyboard: [
      BUTTON_STYLE_KEYS.slice(0, 2).map((s) => ({
        text: `${s === current ? I(b, "back") + " " : ""}${BUTTON_STYLES[s]}`.slice(0, 64),
        callback_data: `a:btc:${key}:${s}`,
      })),
      BUTTON_STYLE_KEYS.slice(2).map((s) => ({
        text: `${s === current ? I(b, "back") + " " : ""}${BUTTON_STYLES[s]}`.slice(0, 64),
        callback_data: `a:btc:${key}:${s}`,
      })),
      ...(isLabelCustomised(b, key) ? [[{ text: `${I(b, "reset")} Reset to default`, callback_data: `a:btr:${key}` }]] : []),
      [{ text: `${I(b, "back")} Back to buttons`, callback_data: "a:labels:0" }],
    ],
  };
}

async function styleScreen(snapshot?: Branding): Promise<Screen> {
  const b = snapshot ?? (await getBranding());
  return {
    text:
      `${I(b, "brush")} <b>Global Default Button Colour</b>\n\n` +
      `Applies to buttons without their own colour.\n\n` +
      `Current: <b>${BUTTON_STYLES[b.defaultStyle]}</b>`,
    keyboard: [
      ...BUTTON_STYLE_KEYS.map((s) => [
        { text: `${BUTTON_STYLES[s]}${s === b.defaultStyle ? `  ${I(b, "back")} active` : ""}`, callback_data: `a:sty:${s}` },
      ]),
      ...back(b),
    ],
  };
}

async function topScreen(): Promise<Screen> {
  const [b, requested, downloaded] = await Promise.all([getBranding(), getMostRequestedCourses(5), getMostDownloadedCourses(5)]);
  const fmt = (rows: { title: string; count: number }[]) =>
    rows.length ? rows.map((r, i) => `${i + 1}. ${esc(r.title.slice(0, 40))} — <b>${r.count}</b>`).join("\n") : "<i>No data yet</i>";
  return {
    text:
      `${I(b, "trophy")} <b>Top Courses</b>\n\n` +
      `${I(b, "trend")} <b>Most requested</b>\n${fmt(requested)}\n\n` +
      `${I(b, "dashboard")} <b>Most downloaded</b>\n${fmt(downloaded)}`,
    keyboard: back(b),
  };
}

async function usersScreen(page: number): Promise<Screen> {
  const b = await getBranding();
  const total = await db.telegramUser.count();
  const totalPages = Math.max(1, Math.ceil(total / PAGE));
  const safe = Math.min(page, totalPages - 1);
  const rows = await db.telegramUser.findMany({
    orderBy: { lastSeenAt: "desc" },
    skip: safe * PAGE,
    take: PAGE,
    select: { id: true, telegramId: true, username: true, firstName: true, blocked: true, botBlocked: true },
  });
  return {
    text:
      `${I(b, "list")} <b>Recent Users</b>\n\nTotal <b>${total}</b>. Tap a user to block or unblock them.\n` +
      `<i>${I(b, "ok")} active · ${I(b, "blocked")} blocked · ${I(b, "sleeping")} dormant</i>`,
    keyboard: [
      ...rows.map((u) => [
        {
          text: `${u.blocked ? I(b, "blocked") : u.botBlocked ? I(b, "sleeping") : I(b, "ok")} ${u.username ? "@" + u.username : u.firstName || u.telegramId}`.slice(0, 64),
          callback_data: `a:ub:${u.id}`,
        },
      ]),
      ...pager(b, "a:users", safe, totalPages),
      ...back(b),
    ],
  };
}

async function broadcastScreen(): Promise<Screen> {
  const b = await getBranding();
  const audience = await db.telegramUser.count({ where: { blocked: false, botBlocked: false } });
  const recent = await db.broadcast.findFirst({
    orderBy: { createdAt: "desc" },
    select: { status: true, totalCount: true, sentCount: true, failedCount: true, skippedCount: true },
  });
  return {
    text:
      `${I(b, "broadcast")} <b>Broadcast</b>\n\nAudience: <b>${audience}</b> user${audience === 1 ? "" : "s"}\n\n` +
      (recent
        ? `Last: <b>${recent.status}</b> — sent ${recent.sentCount}/${recent.totalCount}, failed ${recent.failedCount}, skipped ${recent.skippedCount}\n\n`
        : "") +
      `${I(b, "export")} Send the message text now.\n<i>Delivery is paced to Telegram's limits. /cancel to abort.</i>`,
    keyboard: back(b),
  };
}

// ── dispatcher ─────────────────────────────────────────────────────────

/**
 * Handles an admin callback. Returns false when the callback is not an admin
 * one, so the normal handler can deal with it.
 */
export async function handleAdminCallback(
  q: { id: string; data?: string; message?: { message_id: number; chat: { id: number } } },
  telegramId: string,
  userId: string
): Promise<boolean> {
  if (!q.data?.startsWith("a:")) return false;
  // The gate: naming an admin action never grants it.
  if (!isBotAdmin(telegramId)) {
    await answerCallbackQuery(q.id);
    console.warn("[telegram] non-admin attempted an admin callback");
    return true;
  }
  const cb = decodeAdmin(q.data);
  if (!cb) {
    await answerCallbackQuery(q.id);
    return true;
  }
  const b = await getBranding();

  const chatId = q.message ? String(q.message.chat.id) : telegramId;
  const messageId = q.message?.message_id ?? null;
  let screen: Screen | null = null;
  let toast = "";

  switch (cb.k) {
    case "home": await setState(userId, null); screen = await homeScreen(b); break;
    case "stats": screen = await statsScreen(b); break;
    case "close":
      await answerCallbackQuery(q.id);
      if (messageId !== null) await editMessageText(chatId, messageId, `${I(await getBranding(), "admin")} Panel closed.`, {});
      return true;
    case "export": {
      await answerCallbackQuery(q.id, "Preparing export…");
      await sendExport(chatId, await getBranding());
      return true;
    }
    case "icons": await setState(userId, null); screen = await iconsScreen(cb.page, b); break;
    case "icon": {
      if (!(cb.key in ICON_META)) break;
      await setState(userId, { mode: "icon", key: cb.key });
      screen = await iconEditScreen(cb.key as IconKey, b);
      break;
    }
    case "iconReset": {
      if (!(cb.key in ICON_META)) break;
      const saved = await saveBranding(
        brandingSchema.parse({ ...b, icons: Object.fromEntries(Object.entries(b.icons).filter(([k]) => k !== cb.key)) })
      );
      toast = "Reset to default";
      screen = await iconEditScreen(cb.key as IconKey, saved);
      break;
    }
    case "labels": await setState(userId, null); screen = await labelsScreen(cb.page, b); break;
    case "label": {
      if (!(cb.key in LABEL_META)) break;
      await setState(userId, { mode: "label", key: cb.key });
      screen = await labelEditScreen(cb.key as LabelKey, "", b);
      break;
    }
    case "labelReset": {
      if (!(cb.key in LABEL_META)) break;
      const saved = await saveBranding(
        brandingSchema.parse({ ...b, labels: Object.fromEntries(Object.entries(b.labels).filter(([k]) => k !== cb.key)) })
      );
      toast = "Reset to default";
      screen = await labelEditScreen(cb.key as LabelKey, `${I(saved, "reset")} Reset to default`, saved);
      break;
    }
    case "labelColor": {
      if (!(cb.key in LABEL_META)) break;
      const existing = b.labels[cb.key] ?? { text: labelText(b, cb.key as LabelKey) };
      const next = { ...existing, ...(cb.color === "none" ? { style: undefined } : { style: cb.color }) };
      const saved = await saveBranding(brandingSchema.parse({ ...b, labels: { ...b.labels, [cb.key]: next } }));
      toast = "Colour updated";
      screen = await labelEditScreen(cb.key as LabelKey, `${I(saved, "ok")} Colour updated`, saved);
      break;
    }
    case "style": screen = await styleScreen(b); break;
    case "styleSet": {
      const saved = await saveBranding(brandingSchema.parse({ ...b, defaultStyle: cb.value }));
      toast = "Default colour updated";
      screen = await styleScreen(saved);
      break;
    }
    case "resetAll":
      screen = {
        text: `${I(b, "reset")} <b>Reset appearance?</b>\n\nEvery icon, label and colour returns to its default.\nCourses and users are not affected.`,
        keyboard: [[{ text: `${I(b, "ok")} Yes, reset`, callback_data: "a:rago" }], [{ text: `${I(b, "back")} Cancel`, callback_data: "a:home" }]],
      };
      break;
    case "resetAllGo":
      const cleared = await saveBranding(brandingSchema.parse({ icons: {}, labels: {}, defaultStyle: "none" }));
      toast = "Appearance reset";
      screen = await homeScreen(cleared);
      break;
    case "broadcast": await setState(userId, { mode: "broadcast" }); screen = await broadcastScreen(); break;
    case "broadcastGo": screen = await homeScreen(); break;
    case "dm": await setState(userId, { mode: "dm-id" });
      screen = {
        text: `${I(b, "dm")} <b>DM a user</b>\n\n${I(b, "export")} Send the Telegram user id to message.\n<i>/cancel to abort.</i>`,
        keyboard: back(b),
      };
      break;
    case "top": screen = await topScreen(); break;
    case "users": screen = await usersScreen(cb.page); break;
    case "userBlock": {
      const target = await db.telegramUser.findUnique({ where: { id: cb.id }, select: { id: true, blocked: true } });
      if (!target) { toast = "User not found"; screen = await usersScreen(0); break; }
      await db.telegramUser.update({ where: { id: target.id }, data: { blocked: !target.blocked } });
      toast = target.blocked ? "Unblocked" : "Blocked";
      screen = await usersScreen(0);
      break;
    }
  }

  await answerCallbackQuery(q.id, toast || undefined);
  if (screen) {
    if (messageId !== null) {
      const res = await editMessageText(chatId, messageId, screen.text, { replyMarkup: screen.keyboard });
      if (res.ok || res.description.includes("message is not modified")) return true;
    }
    await sendMessage(chatId, screen.text, { replyMarkup: screen.keyboard });
  }
  return true;
}

/** Consumes a pending admin text input. Returns true when it handled the message. */
export interface MessageEntity {
  type: string;
  offset: number;
  length: number;
  custom_emoji_id?: string;
}

/**
 * Pulls a premium emoji out of a message.
 *
 * When someone sends a custom emoji, Telegram delivers the *fallback* glyph in
 * `text` plus a `custom_emoji` entity carrying the real id. Reading `text`
 * alone silently downgrades every premium emoji to a plain one — which is
 * exactly what used to happen here.
 *
 * Entity offsets are UTF-16 code units, which is also how JS indexes strings,
 * so slicing directly is correct.
 */
function extractPremiumEmoji(
  text: string,
  entities: MessageEntity[] | undefined
): { premiumId: string; char: string } | null {
  const entity = entities?.find((e) => e.type === "custom_emoji" && e.custom_emoji_id);
  if (!entity?.custom_emoji_id) return null;
  const char = text.slice(entity.offset, entity.offset + entity.length).trim();
  // Telegram requires a real emoji as the fallback; refuse to invent one.
  if (!char) return null;
  return { premiumId: entity.custom_emoji_id, char: char.slice(0, MAX_ICON_LENGTH) };
}

export async function handleAdminInput(
  telegramId: string,
  userId: string,
  chatId: string,
  text: string,
  entities?: MessageEntity[]
): Promise<boolean> {
  if (!isBotAdmin(telegramId)) return false;
  const row = await db.telegramUser.findUnique({ where: { id: userId }, select: { adminState: true } });
  const state = parseAdminState(row?.adminState);
  if (!state) return false;

  const b = await getBranding();
  // Any command aborts the pending edit. Without this, typing /admin or /start
  // mid-edit would be saved *as* the new icon or label.
  if (text.startsWith("/")) {
    await setState(userId, null);
    if (text.trim().toLowerCase() === "/cancel") {
      const home = await homeScreen(b);
      await sendMessage(chatId, `${I(b, "close")} Cancelled.`, {});
      await sendMessage(chatId, home.text, { replyMarkup: home.keyboard });
      return true;
    }
    // Let the normal command handler deal with it.
    return false;
  }

  switch (state.mode) {
    case "icon": {
      if (!(state.key in ICON_META)) { await setState(userId, null); return true; }
      const premium = extractPremiumEmoji(text, entities);
      const plain = text.trim();
      if (!premium && (!plain || plain.length > MAX_ICON_LENGTH)) {
        await sendMessage(chatId, `${I(b, "warn")} Send a single emoji (max ${MAX_ICON_LENGTH} characters).`, {});
        return true;
      }
      const value = premium ?? plain;
      // Read fresh, not through the cache: this runs right after another write
      // and must not build on a stale snapshot.
      const current = await readBrandingFresh();
      const saved = await saveBranding(
        brandingSchema.parse({ ...current, icons: { ...current.icons, [state.key]: value } })
      );
      await setState(userId, null);
      // Render from what we just saved, so the panel can never show the old icon.
      const screen = await iconsScreen(0, saved);
      const shown = premium
        ? `<tg-emoji emoji-id="${premium.premiumId}">${premium.char}</tg-emoji> ${I(b, "premium")} (premium)`
        : plain;
      await sendMessage(chatId, `${I(b, "ok")} <b>${esc(ICON_META[state.key as IconKey].name)}</b> is now ${shown}`, {});
      await sendMessage(chatId, screen.text, { replyMarkup: screen.keyboard });
      return true;
    }
    case "label": {
      if (!(state.key in LABEL_META)) { await setState(userId, null); return true; }
      const value = text.trim();
      if (!value || value.length > MAX_LABEL_LENGTH) {
        await sendMessage(chatId, `${I(b, "warn")} Label must be 1–${MAX_LABEL_LENGTH} characters.`, {});
        return true;
      }
      const current = await readBrandingFresh();
      const existing = current.labels[state.key];
      // A premium emoji typed alongside the label becomes that button's icon and
      // is stripped from the caption, because Telegram already draws the custom
      // emoji in front of the text — leaving the fallback glyph in would show it
      // twice. If the admin sent *only* an emoji there is no caption left, so
      // fall back to the shipped default rather than re-inserting the glyph.
      const premium = extractPremiumEmoji(text, entities);
      const cleaned = premium
        ? value.split(premium.char).join("").replace(/\s+/g, " ").trim() || LABEL_META[state.key as LabelKey].default
        : value;
      const saved = await saveBranding(
        brandingSchema.parse({
          ...current,
          labels: {
            ...current.labels,
            [state.key]: { ...existing, text: cleaned, ...(premium ? { iconId: premium.premiumId } : {}) },
          },
        })
      );
      await setState(userId, null);
      const screen = await labelsScreen(0, saved);
      await sendMessage(chatId, `${I(saved, "ok")} Button is now <code>${esc(cleaned)}</code>`, {});
      await sendMessage(chatId, screen.text, { replyMarkup: screen.keyboard });
      return true;
    }
    case "broadcast": {
      const body = text.trim();
      if (!body || body.length > 3500) {
        await sendMessage(chatId, `${I(b, "warn")} Message must be 1–3500 characters.`, {});
        return true;
      }
      await setState(userId, null);
      const broadcast = await db.broadcast.create({ data: { body } });
      const total = await queueBroadcast(broadcast.id);
      await sendMessage(chatId, `${I(b, "broadcast")} Broadcast queued for <b>${total}</b> user${total === 1 ? "" : "s"}.\nDelivery is paced; progress is on the website.`, {});
      // Same engine as the web panel; the cron pump continues it if it outlives this request.
      void runBroadcast(broadcast.id).catch((err) => console.error("[telegram] admin broadcast failed:", err));
      return true;
    }
    case "dm-id": {
      const id = text.trim();
      if (!/^\d{1,20}$/.test(id)) {
        await sendMessage(chatId, `${I(b, "warn")} Send a numeric Telegram user id.`, {});
        return true;
      }
      await setState(userId, { mode: "dm-text", target: id });
      await sendMessage(chatId, `${I(b, "target")} Target locked: <code>${esc(id)}</code>\n\n${I(b, "export")} Now send the message text.\n<i>/cancel to abort.</i>`, {});
      return true;
    }
    case "dm-text": {
      const body = text.trim();
      if (!body || body.length > 3500) {
        await sendMessage(chatId, `${I(b, "warn")} Message must be 1–3500 characters.`, {});
        return true;
      }
      await setState(userId, null);
      const res = await sendMessage(state.target, body);
      await sendMessage(
        chatId,
        res.ok ? `${I(b, "ok")} Message delivered.` : `${I(b, "warn")} Couldn't deliver: ${esc(res.description.slice(0, 120))}`,
        {}
      );
      return true;
    }
  }
}

/** JSON snapshot of bot-side data, sent as a document. Never includes secrets. */
async function sendExport(chatId: string, b: Branding): Promise<void> {
  const [users, events, broadcasts] = await Promise.all([
    db.telegramUser.findMany({
      select: { telegramId: true, username: true, firstName: true, blocked: true, botBlocked: true, firstSeenAt: true, lastSeenAt: true },
      take: 5000,
    }),
    db.telegramEvent.groupBy({ by: ["type"], _count: { _all: true } }),
    db.broadcast.findMany({
      select: { body: true, status: true, totalCount: true, sentCount: true, failedCount: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  const payload = JSON.stringify(
    { exportedAt: new Date().toISOString(), site: siteUrl(), users, eventTotals: events.map((e) => ({ type: e.type, count: e._count._all })), broadcasts },
    null,
    2
  );

  // sendDocument needs multipart, so it is built here rather than in the JSON client.
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", `${I(b, "export")} Bot data export — ${users.length} users`);
  form.append("document", new Blob([payload], { type: "application/json" }), `bot-export-${Date.now()}.json`);
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("token not configured");
    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.error("[telegram] export upload failed with status", res.status);
      await sendMessage(chatId, `${I(b, "warn")} Couldn't send the export file.`, {});
    }
  } catch (err) {
    console.error("[telegram] export failed:", err);
    await sendMessage(chatId, `${I(b, "warn")} Couldn't build the export.`, {});
  }
}

export { homeScreen as adminHomeScreen };
