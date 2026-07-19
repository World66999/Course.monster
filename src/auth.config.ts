import type { NextAuthConfig } from "next-auth";
import { ADMIN_BASE, ADMIN_LOGIN_PATH } from "@/lib/admin-path";

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
        if (isLoggedIn) {
          // Behind a reverse proxy the request origin is the internal
          // address, so build redirects on the canonical public origin.
          const base =
            process.env.AUTH_URL ??
            process.env.NEXT_PUBLIC_SITE_URL ??
            request.nextUrl.origin;
          return Response.redirect(new URL(ADMIN_BASE, base));
        }
        return true;
      }
      if (isAdminArea) return isLoggedIn;
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "ADMIN";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "ADMIN" | "EDITOR";
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
