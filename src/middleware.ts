import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { createPageTicket } from "@/lib/page-ticket";

const { auth } = NextAuth(authConfig);

const DOWNLOAD_PAGE_RE = /^\/download\/([^/]+)$/;

/**
 * Wraps auth() with a custom handler so the download page can get a
 * page-ticket cookie (see src/lib/page-ticket.ts + /api/download/init) on
 * every real page load.
 *
 * IMPORTANT: providing a custom handler to auth() changes next-auth's own
 * control flow (verified against node_modules/next-auth/lib/index.js). Its
 * built-in "redirect to signin if not authorized" fallback only runs when
 * NO custom handler is given — with one, next-auth invokes the handler
 * unconditionally, even where authConfig.authorized() would have returned
 * false or redirected. So this handler re-runs the real authorized()
 * callback itself (by reference, not reimplemented) and reproduces
 * next-auth's own default redirect for the "not authorized" case *before*
 * doing anything else, so every existing path (in particular the admin
 * area gate) behaves exactly as it did before this file existed.
 */
export default auth(async (req) => {
  const authorizedFn = authConfig.callbacks?.authorized;
  const authorized = authorizedFn ? await authorizedFn({ request: req, auth: req.auth }) : true;

  if (authorized instanceof Response) {
    return authorized;
  }
  if (!authorized) {
    const signInUrl = req.nextUrl.clone();
    signInUrl.pathname = authConfig.pages?.signIn ?? "/api/auth/signin";
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.href);
    return NextResponse.redirect(signInUrl);
  }

  const res = NextResponse.next();

  if (req.method === "GET") {
    const match = DOWNLOAD_PAGE_RE.exec(req.nextUrl.pathname);
    if (match) {
      try {
        const ticket = await createPageTicket(decodeURIComponent(match[1]));
        res.cookies.set("dl_ticket", ticket, {
          httpOnly: true,
          // Match Auth.js's own rule (see @auth/core/lib/utils/cookie.js):
          // secure cookies are gated on the request actually being HTTPS,
          // not NODE_ENV — `next start` always sets NODE_ENV=production
          // regardless of environment, which would otherwise make this
          // cookie unusable when testing over plain HTTP.
          secure: req.nextUrl.protocol === "https:",
          sameSite: "lax",
          path: "/",
          maxAge: 900,
        });
      } catch (err) {
        // Never let ticket-minting failure break the page render — the API
        // route fails closed on a missing ticket, which is the safe default.
        console.error("[middleware] failed to mint page ticket:", err);
      }
    }
  }

  return res;
});

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
