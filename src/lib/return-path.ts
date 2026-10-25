import { safeInternalPath } from "@/lib/safe-url";

/**
 * Where to send a buyer once their Premium is active: the page they were on
 * when they clicked "Skip ads". Client-supplied, so it is kept only if it is a
 * same-site path to one of the pages Premium unlocks; anything else is null
 * and the buyer lands on the usual welcome screen.
 */
const ALLOWED = [
  /^\/download\/[a-z0-9][a-z0-9-]{0,190}$/,
  /^\/courses\/[a-z0-9][a-z0-9-]{0,190}$/,
  /^\/premium-(resources|chats)$/,
];

export function safeReturnPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const path = safeInternalPath(raw);
  return ALLOWED.some((re) => re.test(path)) ? path : null;
}
