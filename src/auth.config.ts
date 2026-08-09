import type { NextAuthConfig } from "next-auth";
import { ADMIN_BASE, ADMIN_LOGIN_PATH } from "@/lib/admin-path";
import { isStaff } from "@/lib/roles";

/**
 * Edge-safe Auth.js config (no Node-only imports) shared by middleware
 * and the full server config in `src/auth.ts`.
 */
export const authConfig = {
  pages: {
    signIn: ADMIN_LOGIN_PATH,
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 12, // 12 hours
  },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = Boolean(auth?.user);
      const isAdminArea = pathname === ADMIN_BASE || pathname.startsWith(`${ADMIN_BASE}/`);
      const isLoginPage = pathname === ADMIN_LOGIN_PATH;

      if (isLoginPage) {
        if (isLoggedIn && isStaff(auth?.user?.role)) {
          // Behind a reverse proxy the request origin is the internal
          // address, so build redirects on the canonical public origin.
          const base =
            process.env.AUTH_URL ??
            process.env.NEXT_PUBLIC_SITE_URL ??
            request.nextUrl.origin;
          return Response.redirect(new URL(ADMIN_BASE, base));
        }
        // A signed-in non-staff session (e.g. a Google comment account) just
        // sees the login form here — no redirect loop into the admin area.
        return true;
      }
      if (isAdminArea) return isLoggedIn && isStaff(auth?.user?.role);
      return true;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        // Least-privilege fallback — only ever "ADMIN" when the DB row says so.
        token.role = (user as { role?: string }).role ?? "USER";
        token.chatDisplayName = (user as { chatDisplayName?: string | null }).chatDisplayName ?? null;
      }
      // Client-triggered refresh (useSession().update(...)) after a profile
      // edit — merges the new fields into the token immediately instead of
      // waiting for the next full sign-in to pick them up.
      if (trigger === "update" && session) {
        const patch = session as { name?: string; image?: string; email?: string; chatDisplayName?: string };
        if (patch.name) token.name = patch.name;
        if (patch.image) token.picture = patch.image;
        if (patch.email) token.email = patch.email;
        if (patch.chatDisplayName) token.chatDisplayName = patch.chatDisplayName;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "ADMIN" | "EDITOR" | "USER";
        session.user.chatDisplayName = (token.chatDisplayName as string | null | undefined) ?? null;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
