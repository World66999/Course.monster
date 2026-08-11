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
  {
    // Allows self-hosted assets, Cloudflare Turnstile + Web Analytics, Google
    // Analytics and Monetag only.
    //
    // Monetag hosts, all read out of the actual tag rather than guessed:
    //   quge5.com  — the MultiTag script itself (data-zone 269101)
    //   e2ertt.com — referenced from inside tag.min.js
    //   6opo.com   — referenced from inside tag.min.js
    //   3nbf4.com  — importScripts target of /sw.js; these headers apply to
    //                that route too, so the worker needs it in script-src
    // MultiTag then fans out to one host per ad format, each observed as a real
    // CSP violation in a browser rather than assumed:
    //   auqot.com  — /pfe/current/tag.min.js (zone 11552850)
    //   ekhay.com  — /vignette.min.js        (zone 11552849)
    //   b3mny.com  — /tag.min.js             (zone 11552848)
    // Once loaded, each format calls home on a second host, so those need
    // connect-src too. script-src does not authorise fetch(), which is why
    // auqot.com appears in both. Established by a controlled browser test
    // (CSP rewritten locally per variant), never assumed:
    //   auqot.com — /zone?zone_id=11552850, the push format's own config fetch
    //   094kk.com — /400/11552848, the ad request for the b3mny format
    //   jmosl.com — /401/11552849, the ad request for the ekhay vignette
    //
    // my.rtmark.net (/gid.js) is deliberately NOT granted. It is cross-site
    // user-identity syncing rather than ad delivery, and the test proved it is
    // not a prerequisite: with it blocked, both ad requests above still fired
    // normally. It will keep logging a CSP violation in the console; that is
    // the intended outcome, not a defect.
    //
    // Nothing granted in frame-src for these: no such violation was observed.
    // Deliberately explicit hosts, never a wildcard. 'unsafe-eval' is NOT
    // granted: the tag contains no eval() and no new Function().
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.googletagmanager.com https://static.cloudflareinsights.com https://quge5.com https://e2ertt.com https://6opo.com https://3nbf4.com https://auqot.com https://ekhay.com https://b3mny.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://challenges.cloudflare.com https://www.google-analytics.com https://cloudflareinsights.com https://quge5.com https://e2ertt.com https://6opo.com https://3nbf4.com https://auqot.com https://094kk.com https://jmosl.com",
      "frame-src https://challenges.cloudflare.com https://www.youtube-nocookie.com https://quge5.com https://e2ertt.com https://6opo.com",
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
    ];
  },
};

export default nextConfig;
