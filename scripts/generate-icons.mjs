// Renders the app icons in public/icons from one SVG drawing.
// Run: node scripts/generate-icons.mjs   (needs sharp, already a dependency)
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = new URL("../public/icons/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

/** Brand tile: purple → orchid → gold, a graduation cap, and the gold spark. */
function tile({ radius, pad }) {
  const s = 512;
  const g = (s - pad * 2) / 24; // lucide's 24-unit grid scaled into the safe area
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6d3df5"/><stop offset="0.55" stop-color="#a855f7"/><stop offset="1" stop-color="#e0a106"/>
    </linearGradient>
  </defs>
  <rect width="${s}" height="${s}" rx="${radius}" fill="url(#g)"/>
  <g transform="translate(${pad} ${pad}) scale(${g})" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/>
    <path d="M22 10v6"/>
    <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>
  </g>
  <circle cx="${s - pad * 0.95}" cy="${pad * 0.95}" r="${s * 0.055}" fill="#f5c451" stroke="#ffffff" stroke-opacity="0.55" stroke-width="6"/>
</svg>`;
}

const rounded = tile({ radius: 112, pad: 112 });
// Maskable: full-bleed square, artwork inside the central 80% safe zone.
const maskable = tile({ radius: 0, pad: 136 });

writeFileSync(OUT + "icon.svg", rounded);
const jobs = [
  [rounded, 192, "icon-192.png"],
  [rounded, 512, "icon-512.png"],
  [maskable, 512, "maskable-512.png"],
  [maskable, 180, "apple-touch-icon.png"],
];
for (const [svg, size, name] of jobs) {
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(OUT + name);
  console.log("wrote", name);
}
