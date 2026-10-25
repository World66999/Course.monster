/**
 * Plain-text input normalisation for user-written messages (support tickets,
 * members' chat). Output is always rendered as React text — never as HTML —
 * so this is about keeping stored text sane, not about escaping: it drops
 * control and bidi-override characters (used to disguise text), normalises
 * Unicode, caps blank-line runs, and trims.
 */
export function cleanText(input: unknown, maxLength: number): string {
  if (typeof input !== "string") return "";
  return input
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    // C0/C1 controls except \n and \t, plus bidi embedding/override/isolate marks.
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F‪-‮⁦-⁩]/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, maxLength);
}
