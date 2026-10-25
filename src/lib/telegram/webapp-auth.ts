import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Telegram Mini App initData verification (core.telegram.org/bots/webapps,
 * "Validating data received via the Mini App").
 *
 *   secret_key = HMAC_SHA256(key = "WebAppData", data = bot_token)
 *   hash       = hex(HMAC_SHA256(key = secret_key, data = data_check_string))
 *
 * where data_check_string is every field except `hash` (and `signature`, which
 * is for third-party Ed25519 validation), sorted by key, as "key=value" joined
 * with "\n". The data is only as fresh as `auth_date`, so stale data is refused
 * — a captured initData string cannot be replayed into a new session later.
 */

const MAX_AGE_SECONDS = 60 * 60;

export interface WebAppUser {
  telegramId: string;
  username?: string;
  firstName?: string;
}

export function verifyInitData(
  initData: string,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): WebAppUser | null {
  if (!initData || initData.length > 4096 || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;

  const pairs: string[] = [];
  for (const [key, value] of params) {
    if (key === "hash" || key === "signature") continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(pairs.join("\n")).digest();
  const given = Buffer.from(hash, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const authDate = Number(params.get("auth_date"));
  if (!Number.isInteger(authDate) || authDate > nowSeconds + 60 || nowSeconds - authDate > MAX_AGE_SECONDS) {
    return null;
  }

  try {
    const user = JSON.parse(params.get("user") ?? "null") as { id?: number; username?: string; first_name?: string } | null;
    if (!user || typeof user.id !== "number" || !Number.isSafeInteger(user.id)) return null;
    return { telegramId: String(user.id), username: user.username, firstName: user.first_name };
  } catch {
    return null;
  }
}
