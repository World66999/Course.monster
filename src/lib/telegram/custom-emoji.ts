import "server-only";
import { getCustomEmojiStickers } from "./api";
import { hasBotToken } from "./config";
import { MAX_ICON_LENGTH } from "./branding-schema";

/**
 * Validation for premium (custom) emoji ids.
 *
 * Two things make an id safe to store:
 *
 *  - Format. Telegram rejects the *entire message* when an id is not numeric
 *    ("Field \"icon_custom_emoji_id\" must be a valid Number", and for text
 *    "can't parse entities: Invalid custom emoji identifier specified"), and
 *    that rejection happens before the chat is even resolved. A malformed id
 *    saved into branding would therefore black out every screen, so the format
 *    check is a hard gate.
 *
 *  - Existence. A numeric id that does not exist passes payload validation and
 *    fails silently instead, which is exactly the "I set it and nothing
 *    happened" case. getCustomEmojiStickers resolves real ids, so an unknown
 *    one is refused up front rather than stored and quietly ignored.
 *
 * Telegram also requires the fallback to be a real emoji, and the sticker
 * carries its own, so the fallback is taken from Telegram rather than from
 * whatever glyph happened to arrive in the message.
 */

export const CUSTOM_EMOJI_ID_RE = /^\d{1,32}$/;

export type EmojiCheck =
  | { ok: true; premiumId: string; char: string; setName: string | null; verified: boolean }
  | { ok: false; reason: "format" | "unknown"; message: string };

export async function validateCustomEmoji(id: string, fallbackChar: string): Promise<EmojiCheck> {
  if (!CUSTOM_EMOJI_ID_RE.test(id)) {
    return { ok: false, reason: "format", message: "Custom emoji id must be numeric." };
  }
  const unverified = (): EmojiCheck => ({
    ok: true,
    premiumId: id,
    char: (fallbackChar || "⭐").slice(0, MAX_ICON_LENGTH),
    setName: null,
    verified: false,
  });

  if (!hasBotToken()) {
    // Nothing to check against; the format gate already prevents a broken payload.
    return unverified();
  }

  const res = await getCustomEmojiStickers([id]);
  if (!res.ok) {
    // Only a definitive "this identifier is invalid" is a refusal. A transport
    // failure, timeout or auth problem means we could not *ask* — refusing then
    // would make a Telegram outage block legitimate configuration, and the
    // numeric-format gate above already rules out a payload-breaking value.
    if (/invalid custom emoji/i.test(res.description)) {
      return { ok: false, reason: "format", message: "Telegram rejected that custom emoji id." };
    }
    console.warn("[telegram] could not verify custom emoji id:", res.description);
    return unverified();
  }
  const sticker = res.result.find((s) => s.custom_emoji_id === id) ?? res.result[0];
  if (!sticker) {
    return {
      ok: false,
      reason: "unknown",
      message: "Telegram doesn't know that custom emoji. Send the emoji itself rather than typing an id.",
    };
  }
  // Prefer Telegram's own emoji for the fallback — it is guaranteed valid.
  const char = (sticker.emoji ?? fallbackChar ?? "⭐").slice(0, MAX_ICON_LENGTH);
  return { ok: true, premiumId: id, char: char || "⭐", setName: sticker.set_name ?? null, verified: true };
}

/**
 * Whether this bot can use custom emoji at all. Telegram only renders
 * `icon_custom_emoji_id` for bots that bought a username on Fragment, or in
 * messages the bot sends directly when its owner has Telegram Premium — so a
 * successful lookup proves the id is real, not that it will render for
 * everyone. Reported to the admin in exactly those terms.
 */
/**
 * A known-good id used purely to probe whether lookups work at all. It is never
 * stored as an icon and never rendered — it is the documented example id from
 * Telegram's own API reference, used here the way a ping uses a fixed address.
 */
const CAPABILITY_PROBE_ID = "5368324170671202286";

export async function customEmojiCapability(): Promise<{ canResolve: boolean; detail: string }> {
  if (!hasBotToken()) return { canResolve: false, detail: "Bot token not configured." };
  const res = await getCustomEmojiStickers([CAPABILITY_PROBE_ID]);
  if (!res.ok) return { canResolve: false, detail: `Telegram lookup failed: ${res.description}` };
  return {
    canResolve: true,
    detail:
      "Custom emoji ids can be resolved. Whether they visually render depends on Telegram: " +
      "button icons need a Fragment username or a Premium bot owner.",
  };
}
