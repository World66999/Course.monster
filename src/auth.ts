import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { authConfig } from "@/auth.config";
import { checkRateLimit } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // Throttle brute-force attempts per email (in addition to IP limits).
        const rl = checkRateLimit(`login:${email.toLowerCase()}`, {
          limit: 10,
          windowMs: 15 * 60 * 1000,
        });
        if (!rl.ok) return null;

        const user = await db.user.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (!user) {
          // Constant-time-ish behavior: still run a hash comparison.
          await bcrypt.compare(password, "$2a$12$invalidinvalidinvalidinvaOOOOOOOOOOOOOOOOOOOOOOOOOOOOO");
          return null;
        }
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
});
