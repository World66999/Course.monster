/**
 * Group addressing: in a group the bot sees every message, but it must only
 * answer the ones meant for it, or each chat line turns into a course search.
 *
 * A group message counts as addressed to the bot when it
 *   - @mentions the bot (by username, or a text_mention of the bot's id),
 *   - replies to one of the bot's own messages, or
 *   - is a command with no @suffix or with this bot's @suffix.
 * Private chats are always addressed.
 */

export interface BotIdentity {
  id: number;
  username: string;
}

export interface AddressableMessage {
  chat: { type?: string };
  text?: string;
  entities?: { type: string; offset: number; length: number; user?: { id: number } }[];
  reply_to_message?: { from?: { id: number } };
}

export function isGroupChat(type: string | undefined): boolean {
  return type === "group" || type === "supergroup";
}

/**
 * Returns the text the bot should act on, with any mention of the bot removed,
 * or null when the message is not addressed to the bot and must be ignored.
 */
export function addressedText(m: AddressableMessage, bot: BotIdentity): string | null {
  const text = m.text ?? "";
  if (!isGroupChat(m.chat.type)) return text;

  const handle = `@${bot.username}`.toLowerCase();

  if (text.startsWith("/")) {
    const head = text.split(/\s+/)[0]!;
    const at = head.indexOf("@");
    // A command addressed to another bot in the same group is not ours.
    if (at === -1 || head.slice(at).toLowerCase() === handle) return text;
    return null;
  }

  const mentions = (m.entities ?? []).filter(
    (e) =>
      (e.type === "mention" && text.slice(e.offset, e.offset + e.length).toLowerCase() === handle) ||
      (e.type === "text_mention" && e.user?.id === bot.id)
  );

  if (mentions.length > 0) {
    // Remove only the @username mentions; a text_mention is the user's own
    // wording (a name), which reads oddly when cut but harmlessly as a search.
    let out = text;
    for (const e of [...mentions].sort((a, b) => b.offset - a.offset)) {
      if (e.type === "mention") out = out.slice(0, e.offset) + out.slice(e.offset + e.length);
    }
    return out.replace(/\s+/g, " ").trim();
  }

  if (m.reply_to_message?.from?.id === bot.id) return text;

  return null;
}
