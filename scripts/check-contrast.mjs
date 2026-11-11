import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

function block(sel) {
  const m = css.match(new RegExp(`${sel}\\s*\\{([\\s\\S]*?)\\n\\}`));
  const out = {};
  for (const line of m[1].split("\n")) {
    const mm = line.match(/^\s*(--[a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/);
    if (mm) out[mm[1]] = mm[2];
  }
  return out;
}
const L = block(":root"), D = block("\\.dark");

const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function lum(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [foreground, background, label, minimum]
const pairs = [
  ["--foreground", "--background", "body text on page", 4.5],
  ["--foreground", "--card", "body text on card", 4.5],
  ["--muted-foreground", "--background", "muted text on page", 4.5],
  ["--muted-foreground", "--card", "muted text on card", 4.5],
  ["--muted-foreground", "--muted", "muted text on muted surface", 4.5],
  ["--primary", "--background", "primary as text on page", 4.5],
  ["--primary", "--card", "primary as text on card", 4.5],
  ["--primary-foreground", "--primary", "primary button label", 4.5],
  // Gold is a fill; accent-coloured *text* uses the ink token (see globals.css).
  ["--accent-ink", "--card", "accent ink as text on card", 4.5],
  ["--accent-foreground", "--accent", "accent button label", 4.5],
  ["--success", "--card", "success text on card", 4.5],
  ["--warning", "--card", "warning text on card", 4.5],
  ["--destructive", "--card", "destructive text on card", 4.5],
  ["--info", "--card", "info text on card", 4.5],
  ["--ring", "--background", "focus ring vs page (non-text)", 3],
  ["--border-strong", "--card", "strong border vs card (non-text)", 3],
  ["--input", "--surface-sunken", "input border vs field fill (non-text)", 3],
  ["--foreground", "--surface-sunken", "input text on field fill", 4.5],
  ["--muted-foreground", "--surface-sunken", "placeholder on field fill", 4.5],
  ["--input", "--background", "input border vs page (non-text)", 3],
];

let fails = 0;
for (const [name, t] of [["LIGHT", L], ["DARK", D]]) {
  console.log(`\n=== ${name} ===`);
  for (const [f, b, label, min] of pairs) {
    if (!t[f] || !t[b]) { console.log(`  ?? missing ${f} or ${b}`); continue; }
    const r = ratio(t[f], t[b]);
    const ok = r >= min;
    if (!ok) fails++;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${r.toFixed(2).padStart(6)}:1  (min ${min})  ${label}`);
  }
}
console.log(fails === 0 ? "\nAll contrast pairs pass." : `\n${fails} FAILING PAIR(S)`);
process.exit(fails === 0 ? 0 : 1);
