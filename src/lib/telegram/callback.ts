/**
 * Callback-data codec.
 *
 * Telegram caps `callback_data` at 1-64 bytes, so nothing structural (search
 * text, URLs, titles) may travel in it. Every value that comes back is
 * attacker-controlled — a user can craft any callback_data they like — so this
 * module only *parses shapes*. Authorisation and existence checks always
 * happen afterwards against the database.
 */

export type Callback =
  | { kind: "home" }
  | { kind: "browse"; page: number }
  | { kind: "upcoming"; page: number }
  | { kind: "search"; page: number }
  | { kind: "course"; courseId: string; from: "browse" | "search" | "upcoming"; page: number }
  | { kind: "download"; courseId: string }
  | { kind: "help" }
  | { kind: "noop" };

/** Course ids are cuids; anything else is rejected before it reaches the DB. */
const CUID_RE = /^c[a-z0-9]{20,30}$/;
const MAX_PAGE = 10_000;

const FROM_CODE = { browse: "b", search: "s", upcoming: "u" } as const;
const CODE_FROM = { b: "browse", s: "search", u: "upcoming" } as const;

export function encode(cb: Callback): string {
  switch (cb.kind) {
    case "home": return "h";
    case "help": return "?";
    case "noop": return "n";
    case "browse": return `b:${cb.page}`;
    case "upcoming": return `u:${cb.page}`;
    case "search": return `s:${cb.page}`;
    case "course": return `c:${cb.courseId}:${FROM_CODE[cb.from]}${cb.page}`;
    case "download": return `d:${cb.courseId}`;
  }
}

function parsePage(raw: string): number | null {
  if (!/^\d{1,5}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= MAX_PAGE ? n : null;
}

/** Returns null for anything malformed, oversized, or unrecognised. */
export function decode(raw: string): Callback | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  // Reject anything that could not have come from encode() in the first place.
  if (Buffer.byteLength(raw, "utf8") > 64) return null;

  if (raw === "h") return { kind: "home" };
  if (raw === "?") return { kind: "help" };
  if (raw === "n") return { kind: "noop" };

  const listMatch = /^([bus]):(\d{1,5})$/.exec(raw);
  if (listMatch) {
    const page = parsePage(listMatch[2]);
    if (page === null) return null;
    const kind = listMatch[1] === "b" ? "browse" : listMatch[1] === "u" ? "upcoming" : "search";
    return { kind, page } as Callback;
  }

  const courseMatch = /^c:([a-z0-9]+):([bsu])(\d{1,5})$/.exec(raw);
  if (courseMatch) {
    const [, courseId, fromCode, pageRaw] = courseMatch;
    if (!CUID_RE.test(courseId)) return null;
    const page = parsePage(pageRaw);
    if (page === null) return null;
    return { kind: "course", courseId, from: CODE_FROM[fromCode as keyof typeof CODE_FROM], page };
  }

  const dlMatch = /^d:([a-z0-9]+)$/.exec(raw);
  if (dlMatch) {
    if (!CUID_RE.test(dlMatch[1])) return null;
    return { kind: "download", courseId: dlMatch[1] };
  }

  return null;
}
