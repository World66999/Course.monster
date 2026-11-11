import type { NextConfig } from "next";

export const securityHeaders = [
 { key: "X-Content-Type-Options", value: "nosniff" },
 { key: "X-Frame-Options", value: "DENY" },
 { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
 { key: "X-DNS-Prefetch-Control", value: "on" },
 {
 key: "Permissions-Policy",
 value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
 },
 { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
 // No Cross-Origin-Embedder-Policy. `require-corp` was added on 2026-09-11 and
 // silently broke every cross-origin embed that does not send a CORP header:
 // the YouTube player on /learn (iframe blocked, clicking play showed an error
 // frame), Google profile photos in reviews/comments/chat, and the Turnstile
 // frame. COEP only buys cross-origin isolation (SharedArrayBuffer and
 // friends), which this site does not use — so it cost features for nothing.
 // tests/security-headers.test.ts keeps it out.
 {
 // Allows self-hosted assets, Cloudflare Turnstile + Web Analytics, Google
 // Analytics and Razorpay Checkout (script, iframe, its API) only.
 key: "Content-Security-Policy",
 value: [
 "default-src 'self'",
 "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.googletagmanager.com https://static.cloudflareinsights.com https://checkout.razorpay.com",
 "style-src 'self' 'unsafe-inline'",
 "img-src 'self' data: blob: https:",
 "font-src 'self' data:",
 "connect-src 'self' https://challenges.cloudflare.com https://www.google-analytics.com https://cloudflareinsights.com https://api.razorpay.com https://lumberjack.razorpay.com",
 "frame-src https://challenges.cloudflare.com https://www.youtube-nocookie.com https://api.razorpay.com https://checkout.razorpay.com",
 "object-src 'none'",
 "base-uri 'self'",
 "form-action 'self' https://api.razorpay.com",
 "frame-ancestors 'none'",
 ].join("; "),
 },
];

const nextConfig: NextConfig = {
  // Render <head> metadata up front for every client, not only known bots.
  // Next 15 otherwise streams it into <body> for browsers on dynamic routes,
  // which audits (and some crawlers outside Next's bot list) don't read.
  htmlLimitedBots: /.*/,
 output: "standalone",
 poweredByHeader: false,
 compress: true,
 reactStrictMode: true,
 async headers() {
 return [
 {
 source: "/:path*",
 headers: securityHeaders,
 },
 {
 // Retirement worker for the old Monetag push worker (see public/sw.js):
 // never cache it, so installed copies pick up the replacement promptly.
 source: "/sw.js",
 headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
 },
 {
 // Razorpay Checkout opens bank / UPI windows that must be able to report
 // back to the page; strict same-origin COOP would cut them off. Checkout
 // only — every other page keeps "same-origin". Later rules override.
 source: "/premium/checkout",
 headers: [{ key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" }],
 },
 {
 // App icons are fingerprint-free static files: cache for a week.
 source: "/icons/:path*",
 headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
 },
 {
 source: "/go/:token*",
 headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
 },
 ];
 },
};

export default nextConfig;
