/** Primary site navigation, shared by the desktop header and mobile drawer. */
export const NAV_LINKS = [
  { href: "/", label: "Home" },
  {
    label: "Learn",
    children: [
      { href: "/courses", label: "Courses" },
      { href: "/coding-channels", label: "Coding Channels" },
      { href: "/learn", label: "Free Learning" },
    ],
  },
  {
    label: "Free Stuff",
    children: [
      { href: "/free-resources", label: "Free Resources" },
      { href: "/ai-platforms", label: "Free AI Platforms" },
      { href: "/apps", label: "Apps" },
    ],
  },
  {
    label: "Premium",
    children: [
      { href: "/premium", label: "Premium Plans" },
      { href: "/premium-resources", label: "Premium Resources" },
      { href: "/premium-chats", label: "Telegram Groups" },
      { href: "/premium/support", label: "Purchase Support" },
    ],
  },
  { href: "/downloader", label: "Downloader" },
  { href: "/how-to-download", label: "How to Download" },
] as const;

export type NavLink = { href: string; label: string };
export type NavEntry = NavLink | { label: string; children: readonly NavLink[] };
