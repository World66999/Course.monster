import type { NextConfig } from "next";

const securityHeaders = [
 { key: "X-Content-Type-Options", value: "nosniff" },
 { key: "X-Frame-Options", value: "DENY" },
 { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
 { key: "X-DNS-Prefetch-Control", value: "on" },
 {
 key: "Permissions-Policy",
 value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
 },
 { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
 { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
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
