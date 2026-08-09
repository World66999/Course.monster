"use server";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/ip";
import { generateOtp, hashOtp, verifyOtp, OTP_EXPIRY_MS, OTP_MAX_ATTEMPTS } from "@/lib/otp";
import { sendSignupOtpEmail } from "@/lib/mail";
import { logAudit } from "@/lib/audit";
import { signupFormSchema, verifySignupOtpSchema } from "@/lib/validation";
import type { ActionResult } from "@/server/actions/courses";

const RESEND_COOLDOWN_MS = 60 * 1000;

export async function requestSignupAction(input: unknown): Promise<ActionResult> {
  const parsed = signupFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const username = parsed.data.username.toLowerCase();
  const email = parsed.data.email.toLowerCase();

  const ip = await getClientIp();
  const rl = checkRateLimit(`signup:${hashIp(ip)}`, { limit: 10, windowMs: 60 * 60_000 });
  if (!rl.ok) return { ok: false, error: "Too many signup attempts. Please try again later." };

  const [existingUser, existingUsername] = await Promise.all([
    db.user.findUnique({ where: { email }, select: { id: true } }),
    db.user.findUnique({ where: { username }, select: { id: true } }),
  ]);
  if (existingUser) {
    return { ok: false, error: "An account with this email already exists. Try signing in instead." };
  }
  if (existingUsername) {
    return { ok: false, error: "That username is taken. Please choose another." };
  }

  const existingPending = await db.pendingSignup.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existingPending && existingPending.otpExpiresAt > new Date()) {
    return { ok: false, error: "A verification code was already sent. Check your email or wait to resend." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const code = generateOtp();

  try {
    if (existingPending) {
      await db.pendingSignup.delete({ where: { id: existingPending.id } });
    }
    await db.pendingSignup.create({
      data: {
        username,
        email,
        name: parsed.data.username,
        passwordHash,
        otpHash: hashOtp(code),
        otpExpiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "That username or email is already pending verification." };
    }
    console.error("[signup] failed to create pending signup:", err);
    return { ok: false, error: "Failed to start signup." };
  }

  try {
    await sendSignupOtpEmail(email, code);
  } catch (err) {
    console.error("[signup] failed to send OTP email:", err);
    return { ok: false, error: "Couldn't send the verification email. Please try again." };
  }

  return { ok: true };
}

export async function resendSignupOtpAction(email: unknown): Promise<ActionResult> {
  const parsedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!parsedEmail) return { ok: false, error: "Invalid email" };

  const ip = await getClientIp();
  const rl = checkRateLimit(`signup-resend:${hashIp(ip)}`, { limit: 5, windowMs: 15 * 60_000 });
  if (!rl.ok) return { ok: false, error: "Too many resend attempts. Please try again later." };

  const pending = await db.pendingSignup.findUnique({ where: { email: parsedEmail } });
  if (!pending) return { ok: false, error: "No pending signup found for this email." };

  const sinceLast = Date.now() - (pending.otpExpiresAt.getTime() - OTP_EXPIRY_MS);
  if (sinceLast < RESEND_COOLDOWN_MS) {
    return { ok: false, error: "Please wait a moment before requesting another code." };
  }

  const code = generateOtp();
  await db.pendingSignup.update({
    where: { id: pending.id },
    data: { otpHash: hashOtp(code), otpExpiresAt: new Date(Date.now() + OTP_EXPIRY_MS), attempts: 0 },
  });

  try {
    await sendSignupOtpEmail(parsedEmail, code);
  } catch (err) {
    console.error("[signup] resend failed:", err);
    return { ok: false, error: "Couldn't send the verification email." };
  }
  return { ok: true };
}

export async function verifySignupOtpAction(input: unknown): Promise<ActionResult> {
  const parsed = verifySignupOtpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid code" };
  const email = parsed.data.email.trim().toLowerCase();

  const ip = await getClientIp();
  const rl = checkRateLimit(`signup-verify:${hashIp(ip)}`, { limit: 20, windowMs: 15 * 60_000 });
  if (!rl.ok) return { ok: false, error: "Too many attempts. Please try again later." };

  const pending = await db.pendingSignup.findUnique({ where: { email } });
  if (!pending) return { ok: false, error: "No pending signup found. Please sign up again." };

  if (pending.otpExpiresAt < new Date()) {
    return { ok: false, error: "This code has expired. Please request a new one." };
  }
  if (pending.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: "Too many incorrect attempts. Please request a new code." };
  }

  if (!verifyOtp(parsed.data.code, pending.otpHash)) {
    await db.pendingSignup.update({ where: { id: pending.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: "Incorrect code." };
  }

  try {
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username: pending.username,
          email: pending.email,
          name: pending.name,
          passwordHash: pending.passwordHash,
          emailVerified: new Date(),
          role: "USER",
        },
      });
      await tx.pendingSignup.delete({ where: { id: pending.id } });
      return created;
    });
    await logAudit({ userId: user.id, action: "user.signup", entity: "user", entityId: user.id });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "That username or email was just taken. Please try signing up again." };
    }
    console.error("[signup] account creation failed:", err);
    return { ok: false, error: "Failed to create your account." };
  }

  return { ok: true };
}
