/**
 * Public Telegram community links. Free for everyone: nothing checks Premium
 * or membership for these, and the bot never removes anyone from them (the
 * Premium join gate only acts on chats registered as Premium groups). Not the
 * same as the bot's required channel (TELEGRAM_REQUIRED_CHANNEL).
 *
 * The Telegram bot uses both links. The website shows only the channel: the
 * public community group is not offered on the site (Razorpay onboarding,
 * 2026-10-30).
 */
export const COMMUNITY_LINKS = [
  { key: "channel", label: "Join our Channel", url: "https://t.me/Unique_One_in" },
  { key: "group", label: "Join our Community Group", url: "https://t.me/Unique_One_Chat" },
] as const;

/** What the website shows: the channel only, never the public group. */
export const SITE_COMMUNITY_LINKS = COMMUNITY_LINKS.filter((l) => l.key === "channel");
