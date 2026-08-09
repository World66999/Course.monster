/**
 * Lightweight in-house content filter for comments/reviews. Deliberately not
 * a hard block: matches route the submission to ModerationStatus.HIDDEN
 * (queued for admin review) instead of rejecting the post outright, which
 * avoids frustrating legitimate users on a false positive while still
 * keeping obviously bad content off the public page immediately.
 */

// Intentionally compact — common terms only, whole-word matched. Reports +
// the admin moderation queue are the backstop for everything this misses.
const BLOCKLIST = [
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "cunt",
  "dick",
  "piss",
  "slut",
  "whore",
  "faggot",
  "nigger",
  "retard",
  "rape",
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const BLOCKLIST_RE = new RegExp(`\\b(${BLOCKLIST.map(escapeRegExp).join("|")})\\b`, "i");

export interface ContentCheckResult {
  flagged: boolean;
  reasons: string[];
}

/** Heuristic spam/profanity check. Never throws; worst case is a false negative. */
export function checkContent(text: string): ContentCheckResult {
  const reasons: string[] = [];

  if (BLOCKLIST_RE.test(text)) reasons.push("profanity");

  const urlCount = (text.match(/https?:\/\/|www\./gi) ?? []).length;
  if (urlCount >= 3) reasons.push("excessive-links");

  if (/(.)\1{9,}/.test(text)) reasons.push("repeated-characters");

  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (letters.length > 20) {
    const upper = text.replace(/[^A-Z]/g, "").length;
    if (upper / letters.length > 0.8) reasons.push("excessive-caps");
  }

  return { flagged: reasons.length > 0, reasons };
}
