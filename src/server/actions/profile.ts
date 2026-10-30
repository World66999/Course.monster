"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireUserSafe } from "@/server/auth-helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { generateOtp, hashOtp, verifyOtp, OTP_EXPIRY_MS, OTP_MAX_ATTEMPTS } from "@/lib/otp";
import { sendEmailChangeOtpEmail } from "@/lib/mail";
import { logAudit } from "@/lib/audit";
import {
  displayNameFormSchema,
  changePasswordFormSchema,
  changeEmailRequestSchema,
  changeEmailVerifySchema,
  deleteAccountFormSchema,
} from "@/lib/validation";
import type { ActionResult } from "@/server/actions/courses";

const avatarPathSchema = z.string().regex(/^\/uploads\/[a-zA-Z0-9._-]+$/, "Invalid image path");

/**
 * Shared budget for every action that checks the current password, so a
 * stolen session can't be used to guess the account's password (and reuse it
 * elsewhere) through change-password or delete-account.
 */
function passwordAttemptAllowed(userId: string): boolean {
  return checkRateLimit(`password-check:${userId}`, { limit: 10, windowMs: 15 * 60_000 }).ok;
}
const TOO_MANY_PASSWORD_ATTEMPTS = "Too many attempts. Please wait a few minutes and try again.";

export async function updateDisplayNameAction(input: unknown): Promise<ActionResult> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;
  const parsed = displayNameFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name" };

  await db.user.update({ where: { id: user.id }, data: { name: parsed.data.name } });
  return { ok: true };
}

export async function updateAvatarAction(path: unknown): Promise<ActionResult> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;
  const parsed = avatarPathSchema.safeParse(path);
  if (!parsed.success) return { ok: false, error: "Invalid image" };

  await db.user.update({ where: { id: user.id }, data: { image: parsed.data } });
  return { ok: true };
}

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;
  const parsed = changePasswordFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (dbUser?.passwordHash) {
    if (!parsed.data.currentPassword) {
      return { ok: false, error: "Enter your current password." };
    }
    if (!passwordAttemptAllowed(user.id)) return { ok: false, error: TOO_MANY_PASSWORD_ATTEMPTS };
    const valid = await bcrypt.compare(parsed.data.currentPassword, dbUser.passwordHash);
    if (!valid) return { ok: false, error: "Current password is incorrect." };
  }
  // No existing passwordHash (Google-only account) — this call "sets" a
  // password for the first time rather than "changing" one, no current-
  // password check needed since the session itself already proves identity.

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db.user.update({ where: { id: user.id }, data: { passwordHash } });
  await logAudit({ userId: user.id, action: "user.password_change", entity: "user", entityId: user.id });
  return { ok: true };
}

export async function requestEmailChangeAction(input: unknown): Promise<ActionResult> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;
  const parsed = changeEmailRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const newEmail = parsed.data.newEmail.toLowerCase();

  const rl = checkRateLimit(`email-change:${user.id}`, { limit: 5, windowMs: 60 * 60_000 });
  if (!rl.ok) return { ok: false, error: "Too many requests. Please try again later." };

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { email: true, passwordHash: true },
  });
  if (dbUser?.passwordHash) {
    if (!parsed.data.currentPassword) return { ok: false, error: "Enter your current password." };
    const valid = await bcrypt.compare(parsed.data.currentPassword, dbUser.passwordHash);
    if (!valid) return { ok: false, error: "Current password is incorrect." };
  }
  if (dbUser?.email === newEmail) {
    return { ok: false, error: "That's already your email." };
  }
  const taken = await db.user.findUnique({ where: { email: newEmail }, select: { id: true } });
  if (taken) return { ok: false, error: "That email is already in use." };

  await db.otpToken.updateMany({
    where: { userId: user.id, purpose: "EMAIL_CHANGE", consumedAt: null },
    data: { consumedAt: new Date() },
  });
  const code = generateOtp();
  await db.otpToken.create({
    data: {
      userId: user.id,
      email: newEmail,
      purpose: "EMAIL_CHANGE",
      codeHash: hashOtp(code),
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
    },
  });

  try {
    await sendEmailChangeOtpEmail(newEmail, code);
  } catch (err) {
    console.error("[profile] email-change send failed:", err);
    return { ok: false, error: "Couldn't send the verification email." };
  }
  return { ok: true };
}

export async function verifyEmailChangeAction(input: unknown): Promise<ActionResult> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;
  const parsed = changeEmailVerifySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid code" };

  // Consistent with the signup/password-reset OTP verify actions, which
  // also layer a per-identity rate limit on top of the per-token attempts cap.
  const rl = checkRateLimit(`email-change-verify:${user.id}`, { limit: 20, windowMs: 15 * 60_000 });
  if (!rl.ok) return { ok: false, error: "Too many attempts. Please try again later." };

  const token = await db.otpToken.findFirst({
    where: { userId: user.id, purpose: "EMAIL_CHANGE", consumedAt: null },
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

  try {
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { email: token.email, emailVerified: new Date() } }),
      db.otpToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } }),
    ]);
  } catch {
    return { ok: false, error: "That email was just taken by another account." };
  }

  await logAudit({ userId: user.id, action: "user.email_change", entity: "user", entityId: user.id });
  return { ok: true };
}

/**
 * Anonymizes the account and returns — does NOT sign out server-side. The
 * caller (client) is expected to follow a successful result with
 * next-auth/react's client-side `signOut()`, which is what actually clears
 * the session everywhere instantly (a server-side signOut() sets the cookie
 * correctly but never notifies the client's shared session state).
 */
export async function deleteAccountAction(input: unknown): Promise<ActionResult> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;
  const parsed = deleteAccountFormSchema.safeParse(input);

  const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (dbUser?.passwordHash) {
    if (!passwordAttemptAllowed(user.id)) return { ok: false, error: TOO_MANY_PASSWORD_ATTEMPTS };
    const currentPassword = parsed.success ? parsed.data.currentPassword : "";
    const valid = currentPassword && (await bcrypt.compare(currentPassword, dbUser.passwordHash));
    if (!valid) return { ok: false, error: "Current password is incorrect." };
  }

  // Anonymize rather than hard-delete: a cascade delete would also wipe
  // every comment/review/like this account ever made (onDelete: Cascade on
  // those relations) — an unreasonably destructive side effect of a
  // self-service "delete my account" click. Past content stays attributed
  // to a tombstoned, disabled, unrecoverable account instead.
  await db.$transaction([
    db.account.deleteMany({ where: { userId: user.id } }),
    db.user.update({
      where: { id: user.id },
      data: {
        name: "Deleted user",
        username: null,
        email: `deleted-${user.id}@deleted.invalid`,
        passwordHash: null,
        image: null,
        disabled: true,
      },
    }),
  ]);
  await logAudit({ userId: user.id, action: "user.delete_account", entity: "user", entityId: user.id });

  return { ok: true };
}
