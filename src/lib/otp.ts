import "server-only";
import { randomInt, createHmac, timingSafeEqual } from "node:crypto";

/** Cryptographically random 6-digit code — never Math.random(). */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function secret(): string {
  const s = process.env.OTP_HASH_SECRET;
  if (!s) throw new Error("OTP_HASH_SECRET is not configured");
  return s;
}

/** HMAC-SHA256 keyed hash — OTPs are never stored in plaintext. */
export function hashOtp(code: string): string {
  return createHmac("sha256", secret()).update(code).digest("hex");
}

/** Constant-time comparison against a stored hash. */
export function verifyOtp(code: string, hash: string): boolean {
  const expected = Buffer.from(hashOtp(code), "hex");
  const actual = Buffer.from(hash, "hex");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export const OTP_EXPIRY_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
