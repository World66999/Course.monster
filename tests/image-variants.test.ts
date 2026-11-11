import test from "node:test";
import assert from "node:assert/strict";

/**
 * Naming rules for the AVIF / smaller-size copies of uploaded images. The
 * /uploads route generates a missing copy on request, so `parseVariantName`
 * is also the gate that keeps arbitrary file names from creating files.
 */
import { imageSources, parseVariantName, variantNamesFor } from "../src/lib/image-variants.ts";

const THUMB = "thumbnail-mrt5g561-59c4d1b35730";

test("an uploaded thumbnail gets AVIF, WebP and JPEG sources in three widths", () => {
  const s = imageSources(`/uploads/${THUMB}.webp`);
  assert.ok(s);
  assert.equal(s.avifSrcSet, `/uploads/${THUMB}-400.avif 400w, /uploads/${THUMB}-640.avif 640w, /uploads/${THUMB}.avif 800w`);
  assert.equal(s.webpSrcSet, `/uploads/${THUMB}-400.webp 400w, /uploads/${THUMB}-640.webp 640w, /uploads/${THUMB}.webp 800w`);
  assert.equal(s.fallback, `/uploads/${THUMB}.jpg`);
});

test("icons that can be transparent fall back to PNG, never JPEG", () => {
  assert.equal(imageSources("/uploads/appIcon-abc123-0123456789ab.webp")?.fallback, "/uploads/appIcon-abc123-0123456789ab.png");
  assert.equal(parseVariantName("appIcon-abc123-0123456789ab.jpg"), null);
  assert.ok(parseVariantName("appIcon-abc123-0123456789ab.png"));
});

test("external images, other kinds and non-WebP files are left as plain images", () => {
  assert.equal(imageSources("https://img.youtube.com/vi/x/hqdefault.jpg"), null);
  assert.equal(imageSources("/uploads/meta-abc123-0123456789ab.webp"), null);
  assert.equal(imageSources("/uploads/avatar-abc123-0123456789ab.webp"), null);
  assert.equal(imageSources("/uploads/logo-coursesmonster.png"), null);
  assert.equal(imageSources(null), null);
});

test("only the fixed list of copies can be requested", () => {
  assert.deepEqual(parseVariantName(`${THUMB}-400.avif`), { base: THUMB, kind: "thumbnail", width: 400, format: "avif" });
  assert.deepEqual(parseVariantName(`${THUMB}.avif`), { base: THUMB, kind: "thumbnail", width: null, format: "avif" });
  assert.ok(parseVariantName(`${THUMB}.jpg`));
  // Not in the width list, the stored size itself, or an unknown kind.
  assert.equal(parseVariantName(`${THUMB}-401.avif`), null);
  assert.equal(parseVariantName(`${THUMB}-800.avif`), null);
  assert.equal(parseVariantName(`${THUMB}-9999.webp`), null);
  assert.equal(parseVariantName("meta-abc123-0123456789ab.avif"), null);
  // The full-size WebP is the original, small JPEGs do not exist.
  assert.equal(parseVariantName(`${THUMB}.webp`), null);
  assert.equal(parseVariantName(`${THUMB}-400.jpg`), null);
  // Nothing outside the upload folder.
  assert.equal(parseVariantName("../thumbnail-a-b.avif"), null);
});

test("each original owns exactly its copies, and a copy owns none", () => {
  assert.deepEqual(variantNamesFor(`${THUMB}.webp`).sort(), [
    `${THUMB}-400.avif`, `${THUMB}-400.webp`, `${THUMB}-640.avif`, `${THUMB}-640.webp`, `${THUMB}.avif`, `${THUMB}.jpg`,
  ].sort());
  assert.deepEqual(variantNamesFor(`${THUMB}-400.webp`), []);
  assert.deepEqual(variantNamesFor(`${THUMB}.avif`), []);
  assert.deepEqual(variantNamesFor("avatar-abc123-0123456789ab.webp"), []);
  for (const name of variantNamesFor("banner-abc123-0123456789ab.webp")) assert.ok(parseVariantName(name), name);
});
