import test from "node:test";
import assert from "node:assert/strict";
import nextConfig, { securityHeaders } from "../next.config.ts";

const header = (name: string) =>
  securityHeaders.find((h) => h.key.toLowerCase() === name.toLowerCase())?.value;

/**
 * COEP `require-corp` (added 2026-09-11) blocked the YouTube player on /learn,
 * Google profile photos and the Turnstile frame in production. The site does
 * not need cross-origin isolation, so the header must stay off.
 */
test("no Cross-Origin-Embedder-Policy is sent", () => {
  assert.equal(header("Cross-Origin-Embedder-Policy"), undefined);
});

test("the embeds the site relies on stay allowed by the CSP", () => {
  const csp = header("Content-Security-Policy") ?? "";
  const frameSrc = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("frame-src")) ?? "";
  assert.match(frameSrc, /https:\/\/www\.youtube-nocookie\.com/);
  assert.match(frameSrc, /https:\/\/challenges\.cloudflare\.com/);
  assert.match(csp, /img-src[^;]*https:/, "remote images (e.g. Google avatars) must be allowed");
});

test("the remaining hardening headers are still in place", () => {
  assert.equal(header("X-Content-Type-Options"), "nosniff");
  assert.equal(header("X-Frame-Options"), "DENY");
  assert.equal(header("Cross-Origin-Opener-Policy"), "same-origin");
  assert.match(header("Content-Security-Policy") ?? "", /object-src 'none'/);
});

test("the security headers apply to every route", async () => {
  const rules = (await nextConfig.headers?.()) ?? [];
  const all = rules.find((r) => r.source === "/:path*" || r.source === "/(.*)");
  assert.ok(all, "a catch-all header rule exists");
  assert.equal(all.headers, securityHeaders);
});
