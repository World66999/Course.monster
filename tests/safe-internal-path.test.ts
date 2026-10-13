import test from "node:test";
import assert from "node:assert/strict";
import { safeInternalPath } from "../src/lib/safe-url.ts";

test("same-site paths are returned unchanged", () => {
  for (const p of ["/downloader", "/courses?q=python", "/courses/some-slug#reviews", "/"]) {
    assert.equal(safeInternalPath(p), p);
  }
});

test("anything that could leave the site falls back to the homepage", () => {
  for (const p of [
    "https://evil.example/",
    "//evil.example/",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "evil.example",
    "/ok\nLocation: https://evil.example",
    "/\u0000x",
    "",
    null,
    undefined,
    "/" + "a".repeat(600),
  ]) {
    assert.equal(safeInternalPath(p as string), "/", JSON.stringify(p));
  }
});
