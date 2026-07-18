"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/ip";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const ip = await getClientIp();
  const rl = checkRateLimit(`login-ip:${hashIp(ip)}`, { limit: 15, windowMs: 15 * 60_000 });
  if (!rl.ok) {
    return { error: "Too many login attempts. Please wait 15 minutes." };
  }

  const email = String(formData.get("email") ?? "");
  try {
    await signIn("credentials", {
      email,
      password: String(formData.get("password") ?? ""),
      redirectTo: "/admin",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
      await logAudit({
        userId: user?.id,
        action: "login.failed",
        entity: "user",
        entityId: user?.id,
        meta: { email: email.slice(0, 100) },
      });
      return { error: "Invalid email or password." };
    }
    // next/navigation redirect() throws — rethrow so the redirect happens.
    throw error;
  }
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/admin/login" });
}
