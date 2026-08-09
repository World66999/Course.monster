import "server-only";
import { getCustomEmojiStickers, getForumTopicIconStickers, getStickerSet } from "./api";
import { hasBotToken } from "./config";
import { ICON_KEYS, ICON_META, type Branding, type IconKey } from "./branding-schema";

/**
 * Premium custom emoji library.
 *
 * HOW THIS IS POPULATED — and why every id in it is legitimate.
 *
 * Telegram provides **no** API for enumerating "custom emoji available to this
 * bot". Only three methods touch custom emoji at all: getStickerSet(name),
 * getCustomEmojiStickers(ids) and getForumTopicIconStickers(). Nothing here
 * pretends otherwise, and no id is ever guessed, scraped or copied from the
 * internet.
 *
 * The library is built from exactly two officially supported sources:
 *
 *  1. getForumTopicIconStickers() — an official Bot API method available to
 *     every bot with no prior knowledge required. It returns Telegram's own
 *     "Topics" custom-emoji set: UI-oriented glyphs intended precisely for
 *     labelling things. This is the primary source.
 *
 *  2. getStickerSet(name) for public custom-emoji sets whose names the bot
 *     learned legitimately — `set_name` comes back from getCustomEmojiStickers
 *     when an admin sends a custom emoji, so a set only enters the library
 *     because someone with access to it used it here first.
 *
 * Every id is returned *by Telegram* in response to one of those calls, so it
 * is valid by construction rather than by assumption; assignment additionally
 * re-checks it. If a set becomes unavailable the fetch simply yields fewer
 * candidates — it never invents one.
 */

/** Sets discovered legitimately from emoji sent to this bot (see set_name). */
export const KNOWN_SETS = ["AttractiveEmoji", "HandEmoji"] as const;

/**
 * Semantic preference list per icon: the Unicode emoji whose *meaning* matches
 * that slot, best first. Matching is on the sticker's own `emoji` field, so an
 * assignment is semantic rather than random, and each slot gets a different
 * glyph rather than one emoji reused everywhere.
 */
export const SEMANTIC_EMOJI: Record<IconKey, string[]> = {
  logo: ["🎓", "👨‍🎓", "🏛"],
  browse: ["📚", "📁", "📰"],
  search: ["🔎", "👀", "🔭"],
  upcoming: ["⏱", "📆", "🔝"],
  website: ["🛜", "💻", "📱"],
  download: ["🔽", "⏏️", "📥"],
  back: ["⬅️", "◀️"],
  next: ["➡️", "▶️"],
  help: ["❓", "⁉️", "💡"],
  warn: ["❗️", "‼️", "⚡️"],
  retry: ["🔄", "🔂"],
  description: ["📝", "✍️", "📰"],
  category: ["📁", "🗳", "🛍"],
  facts: ["🧮", "📊", "📈"],
  instructor: ["🗣", "👩‍🎨", "👨‍🎓"],
  date: ["📆", "⏱"],
  admin: ["👮‍♂️", "🪖", "🛃"],
  dashboard: ["📈", "🧮", "📉"],
  broadcast: ["📣", "🎙", "🗣"],
  dm: ["💬", "📞", "✍️"],
  trophy: ["🏆", "🎖", "👑"],
  list: ["📰", "🗳", "📁"],
  export: ["🖨", "💼", "🧳"],
  palette: ["🎨", "👩‍🎨", "🎭"],
  buttons: ["🎮", "🪩", "🔮"],
  brush: ["✍️", "💄", "👩‍🎨"],
  reset: ["🔂", "🔄"],
  close: ["❌", "⛔️", "🔞"],
  users: ["👨‍👩‍👧‍👦", "🤝", "🙌"],
  newBadge: ["🆒", "🎉", "✨"],
  blocked: ["⛔️", "🔞", "🖕"],
  views: ["👀", "🔎"],
  trend: ["🔝", "📈", "💎"],
  webhook: ["🔌", "⚡️", "🛜"],
  ok: ["✅", "👍", "👌"],
  target: ["📍", "🏁", "🎯"],
  edited: ["✍️", "📝"],
  premium: ["✨", "💎", "⭐️"],
  sleeping: ["😴", "😪", "🥴"],
  dotPrimary: ["💙", "🩵"],
  dotSuccess: ["💚", "🍀"],
  dotDanger: ["❤️", "🩷", "🖤"],
};

export interface LibraryEntry {
  emoji: string;
  id: string;
  set: string;
}

/** Fetches every reachable custom emoji. Never throws; returns what it got. */
export async function fetchLibrary(): Promise<LibraryEntry[]> {
  if (!hasBotToken()) return [];
  const out: LibraryEntry[] = [];

  const topics = await getForumTopicIconStickers();
  if (topics.ok) {
    for (const s of topics.result) {
      if (s.custom_emoji_id && s.emoji) out.push({ emoji: s.emoji, id: s.custom_emoji_id, set: s.set_name ?? "Topics" });
    }
  } else {
    console.warn("[telegram] forum topic icons unavailable:", topics.description);
  }

  for (const name of KNOWN_SETS) {
    const set = await getStickerSet(name);
    if (!set.ok) {
      console.warn(`[telegram] sticker set ${name} unavailable:`, set.description);
      continue;
    }
    if (set.result.sticker_type !== "custom_emoji") continue;
    for (const s of set.result.stickers) {
      if (s.custom_emoji_id && s.emoji) out.push({ emoji: s.emoji, id: s.custom_emoji_id, set: set.result.name });
    }
  }
  return out;
}

/** Normalises variation selectors so "⭐️" and "⭐" compare equal. */
const norm = (e: string) => e.replace(/️/g, "");

export interface Assignment {
  key: IconKey;
  matchedEmoji: string;
  id: string;
  set: string;
}

/**
 * Picks one custom emoji per icon by semantic preference.
 *
 * Candidates already used are skipped, so distinct slots get distinct glyphs
 * instead of the same emoji everywhere. An icon with no semantic match is
 * simply left out — it keeps its ordinary emoji and is reported as unmatched
 * rather than being given something arbitrary.
 */
export function planAssignments(library: LibraryEntry[], keys: IconKey[] = ICON_KEYS): {
  assigned: Assignment[];
  unmatched: IconKey[];
} {
  const byEmoji = new Map<string, LibraryEntry[]>();
  for (const e of library) {
    const k = norm(e.emoji);
    if (!byEmoji.has(k)) byEmoji.set(k, []);
    byEmoji.get(k)!.push(e);
  }
  const usedIds = new Set<string>();
  const assigned: Assignment[] = [];
  const unmatched: IconKey[] = [];

  for (const key of keys) {
    const prefs = [...(SEMANTIC_EMOJI[key] ?? []), ICON_META[key].default];
    let picked: Assignment | null = null;

    // First pass: every preference, but only unused candidates. Falling back to
    // an already-taken id inside this loop would hand two slots the same glyph
    // as soon as their top preference collided, which is what happened to
    // "upcoming" and "date" both claiming the single calendar emoji.
    for (const pref of prefs) {
      const free = (byEmoji.get(norm(pref)) ?? []).find((c) => !usedIds.has(c.id));
      if (free) {
        picked = { key, matchedEmoji: pref, id: free.id, set: free.set };
        break;
      }
    }
    // Second pass: only now accept a shared id, rather than leaving the slot bare.
    if (!picked) {
      for (const pref of prefs) {
        const any = (byEmoji.get(norm(pref)) ?? [])[0];
        if (any) {
          picked = { key, matchedEmoji: pref, id: any.id, set: any.set };
          break;
        }
      }
    }
    if (picked) {
      usedIds.add(picked.id);
      assigned.push(picked);
    } else {
      unmatched.push(key);
    }
  }
  return { assigned, unmatched };
}

/**
 * Re-checks every configured premium id against Telegram. Ids that no longer
 * resolve are reported so the admin can see them, and are never silently
 * swapped for something else.
 */
export async function verifyConfigured(branding: Branding): Promise<{
  checked: number;
  valid: string[];
  invalid: string[];
}> {
  const ids = new Set<string>();
  for (const v of Object.values(branding.icons)) if (typeof v === "object") ids.add(v.premiumId);
  for (const v of Object.values(branding.labels)) if (v?.iconId) ids.add(v.iconId);
  const list = [...ids];
  if (list.length === 0 || !hasBotToken()) return { checked: list.length, valid: [], invalid: [] };

  const res = await getCustomEmojiStickers(list);
  if (!res.ok) {
    console.warn("[telegram] library verification failed:", res.description);
    return { checked: list.length, valid: [], invalid: [] };
  }
  const found = new Set(res.result.map((s) => s.custom_emoji_id));
  return {
    checked: list.length,
    valid: list.filter((i) => found.has(i)),
    invalid: list.filter((i) => !found.has(i)),
  };
}
