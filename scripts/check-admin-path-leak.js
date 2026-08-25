#!/usr/bin/env node
/**
 * Fails if the admin panel's secret path segment appears in any JavaScript a
 * public visitor is served.
 *
 * The segment is obscurity layered on top of the real checks in middleware.ts,
 * the panel layout and requireAdmin() — but it only works while it stays
 * unpublished, and there are two ways to publish it by accident:
 *
 *   1. Next writes the compiled middleware matcher to a fixed, guessable URL
 *      under /_next/static. That is why the matcher in middleware.ts is
 *      deliberately generic rather than naming the segment.
 *
 *   2. Any chunk a public route loads. The segment legitimately appears in the
 *      panel's own chunks; those are only fetched while rendering an admin page,
 *      which needs a staff session. What must never happen is it landing in a
 *      chunk the homepage pulls in — one shared import away, if something that
 *      calls adminPath() is moved into a component the public site also renders.
 *
 * Only (1) used to be checked, and (1) alone would not notice (2).
 *
 * Usage: node scripts/check-admin-path-leak.js [buildDir]   (default: .next)
 */
const fs = require("node:fs");
const path = require("node:path");

const buildDir = process.argv[2] || ".next";
const source = fs.readFileSync(path.join("src", "lib", "admin-path.ts"), "utf8");
const match = /^\s*"([A-Za-z0-9]{40,})"/m.exec(source);

if (!match) {
  console.error("could not read ADMIN_SEGMENT from src/lib/admin-path.ts");
  process.exit(2);
}
const segment = match[1];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

let failed = false;

// (1) the middleware manifest
const manifests = walk(path.join(buildDir, "static")).filter((f) =>
  path.basename(f).includes("clientMiddlewareManifest")
);
const leakedManifests = manifests.filter((f) => fs.readFileSync(f, "utf8").includes(segment));
if (leakedManifests.length) {
  console.error("FAIL: the admin segment is in the client middleware manifest:");
  for (const f of leakedManifests) console.error("        " + f);
  failed = true;
} else {
  console.log(`ok - absent from ${manifests.length} middleware manifest(s)`);
}

// (2) every chunk any non-panel route loads
const appManifest = JSON.parse(
  fs.readFileSync(path.join(buildDir, "app-build-manifest.json"), "utf8")
);
const publicChunks = new Set();
for (const [route, chunks] of Object.entries(appManifest.pages || {})) {
  if (route.includes(segment)) continue; // the panel's own routes
  for (const chunk of chunks) publicChunks.add(chunk);
}
const leakedChunks = [...publicChunks].filter((chunk) => {
  try {
    return fs.readFileSync(path.join(buildDir, chunk), "utf8").includes(segment);
  } catch {
    return false;
  }
});
if (leakedChunks.length) {
  console.error("FAIL: the admin segment is in chunks a public route loads:");
  for (const c of leakedChunks) console.error("        " + c);
  failed = true;
} else {
  console.log(`ok - absent from all ${publicChunks.size} chunks any public route loads`);
}

process.exit(failed ? 1 : 0);
