import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { authConfig } from "@/auth.config";
import { checkRateLimit } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  // `email` is kept for the admin login form (unchanged field name); the
  // public login form sends `identifier`, which may be a username or email.
  identifier: z.string().max(200).optional(),
  email: z.string().max(200).optional(),
  password: z.string().min(1).max(200),
});

const DUMMY_HASH = "$2a$12$invalidinvalidinvalidinvaOOOOOOOOOOOOOOOOOOOOOOOOOOOOO";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // Only used for OAuth account linking (Google) — session storage stays
  // JWT (authConfig.session.strategy), so no Session/VerificationToken
  // tables are touched.
  adapter: PrismaAdapter(db),
  providers: [
    Credentials({
      credentials: {
        identifier: { label: "Username or email", type: "text" },
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const raw = (parsed.data.identifier || parsed.data.email || "").trim();
        const { password } = parsed.data;
        if (!raw) return null;

        // Throttle brute-force attempts per identifier (in addition to IP limits).
        const rl = checkRateLimit(`login:${raw.toLowerCase()}`, {
          limit: 10,
          windowMs: 15 * 60 * 1000,
        });
        if (!rl.ok) return null;

        const isEmail = raw.includes("@");
        const user = await db.user.findFirst({
          where: isEmail ? { email: raw.toLowerCase() } : { username: raw.toLowerCase() },
        });

        if (!user || !user.passwordHash) {
          // Constant-time-ish behavior: still run a hash comparison.
          await bcrypt.compare(password, DUMMY_HASH);
          return null;
        }
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;
        // Authoritative gate — the public login action also pre-checks this
        // for a friendlier message, but authorize() is what actually enforces it.
        if (!user.emailVerified || user.disabled) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          chatDisplayName: user.chatDisplayName,
        };
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Safe specifically for Google: it verifies email ownership live during
      // OAuth, so linking to an existing email/password account by matching
      // email is trustworthy here (unlike for providers with unverified
      // emails, which is what makes this flag "dangerous" in general). This
      // is exactly what lets a Google sign-in and an email/password account
      // sharing the same address resolve to one User row instead of a
      // duplicate-email conflict.
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      // Blocks disabled accounts for every provider — Google bypasses
      // authorize(), so this is the only place that check can live for OAuth.
      if (user.id) {
        const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { disabled: true } });
        if (dbUser?.disabled) return false;
      }
      // Populate emailVerified from Google's own verified-email claim (kept
      // out of authorize()/Credentials — irrelevant there).
      if (account?.provider === "google" && user.id && profile?.email_verified) {
        await db.user
          .updateMany({ where: { id: user.id, emailVerified: null }, data: { emailVerified: new Date() } })
          .catch(() => undefined);
      }
      return true;
    },
  },
});
