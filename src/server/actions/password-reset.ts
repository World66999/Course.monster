"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/ip";
import { generateOtp, hashOtp, verifyOtp, OTP_EXPIRY_MS, OTP_MAX_ATTEMPTS } from "@/lib/otp";
import { sendPasswordResetOtpEmail } from "@/lib/mail";
import { logAudit } from "@/lib/audit";
import {
  forgotPasswordFormSchema,
  verifyPasswordResetOtpSchema,
  resetPasswordFormSchema,
} from "@/lib/validation";
import type { ActionResult } from "@/server/actions/courses";

/** How long a consumed OTP's id remains valid as a one-time "proof of verification" ticket. */
const TICKET_WINDOW_MS = 10 * 60 * 1000;

export async function requestPasswordResetAction(input: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid email" };
  const email = parsed.data.email.toLowerCase();

  const ip = await getClientIp();
  const rl = checkRateLimit(`pwreset:${hashIp(ip)}`, { limit: 10, windowMs: 60 * 60_000 });
  if (!rl.ok) return { ok: false, error: "Too many requests. Please try again later." };

  const user = await db.user.findUnique({ where: { email }, select: { id: true, disabled: true } });
  // Never reveal whether the email exists — same response either way.
  if (user && !user.disabled) {
    await db.otpToken.updateMany({
      where: { userId: user.id, purpose: "PASSWORD_RESET", consumedAt: null },
      data: { consumedAt: new Date() }, // invalidate any prior unconsumed tokens
    });
    const code = generateOtp();
    await db.otpToken.create({
      data: {
        userId: user.id,
        email,
        purpose: "PASSWORD_RESET",
        codeHash: hashOtp(code),
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
      },
    });
    try {
      await sendPasswordResetOtpEmail(email, code);
    } catch (err) {
      console.error("[password-reset] send failed:", err);
    }
  }

  return { ok: true };
}

export async function verifyPasswordResetOtpAction(
  input: unknown
): Promise<ActionResult & { ticket?: string }> {
  const parsed = verifyPasswordResetOtpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid code" };
  const email = parsed.data.email.toLowerCase();

  const ip = await getClientIp();
  const rl = checkRateLimit(`pwreset-verify:${hashIp(ip)}`, { limit: 20, windowMs: 15 * 60_000 });
  if (!rl.ok) return { ok: false, error: "Too many attempts. Please try again later." };

  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return { ok: false, error: "Invalid or expired code." };

  const token = await db.otpToken.findFirst({
    where: { userId: user.id, purpose: "PASSWORD_RESET", consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!token || token.expiresAt < new Date()) {
    return { ok: false, error: "This code has expired. Please request a new one." };
  }
  if (token.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: "Too many incorrect attempts. Please request a new code." };
  }
  if (!verifyOtp(parsed.data.code, token.codeHash)) {
    await db.otpToken.update({ where: { id: token.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: "Incorrect code." };
  }

  await db.otpToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } });
  return { ok: true, ticket: token.id };
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = resetPasswordFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const token = await db.otpToken.findUnique({ where: { id: parsed.data.ticket } });
  if (
    !token ||
    token.purpose !== "PASSWORD_RESET" ||
    !token.consumedAt ||
    token.consumedAt.getTime() < Date.now() - TICKET_WINDOW_MS
  ) {
    return { ok: false, error: "Your session expired. Please start the reset again." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await db.user.update({ where: { id: token.userId }, data: { passwordHash } });
  // Single-use: push the ticket's validity window into the past so it can't be replayed.
  await db.otpToken.update({ where: { id: token.id }, data: { consumedAt: new Date(0) } });

  await logAudit({ userId: token.userId, action: "user.password_reset", entity: "user", entityId: token.userId });
  return { ok: true };
}
