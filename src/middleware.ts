import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

/**
 * Deliberately generic matcher.
 *
 * Next.js publishes the compiled matcher to a client-readable file
 * (`/_next/static/<buildId>/_clientMiddlewareManifest.json`), so naming the
 * admin segment here would publish the secret path to anyone who asks for
 * that file. The matcher therefore covers everything except static assets,
 * and the actual admin-path check lives in `authConfig.authorized`, which is
 * compiled into the edge bundle and never served to browsers.
 *
 * Cost is negligible: visitors without a session cookie short-circuit, and
 * `authorized()` returns true immediately for non-admin paths.
 */
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|uploads|favicon.ico|robots.txt|sitemap.xml).*)"],
};
