/**
 * Public Telegram community links. Free for everyone: nothing checks Premium
 * or membership for these, and the bot never removes anyone from them (the
 * Premium join gate only acts on chats registered as Premium groups). Not the
 * same as the bot's required channel (TELEGRAM_REQUIRED_CHANNEL).
 */
export const COMMUNITY_LINKS = [
  { key: "channel", label: "Join our Channel", url: "https://t.me/Unique_One_in" },
  { key: "group", label: "Join our Community Group", url: "https://t.me/Unique_One_Chat" },
] as const;
