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
 // Allows self-hosted assets, Cloudflare Turnstile + Web Analytics and Google
 // Analytics only.
 key: "Content-Security-Policy",
 value: [
 "default-src 'self'",
 "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.googletagmanager.com https://static.cloudflareinsights.com",
 "style-src 'self' 'unsafe-inline'",
 "img-src 'self' data: blob: https:",
 "font-src 'self' data:",
 "connect-src 'self' https://challenges.cloudflare.com https://www.google-analytics.com https://cloudflareinsights.com",
 "frame-src https://challenges.cloudflare.com https://www.youtube-nocookie.com",
 "object-src 'none'",
 "base-uri 'self'",
 "form-action 'self'",
 "frame-ancestors 'none'",
 ].join("; "),
 },
];

const nextConfig: NextConfig = {
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
 source: "/go/:token*",
 headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
 },
 ];
 },
};

export default nextConfig;
