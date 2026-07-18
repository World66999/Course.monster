import "server-only";

/**
 * Server-side Cloudflare Turnstile verification.
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
export async function verifyCaptcha(token: string, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("[captcha] TURNSTILE_SECRET_KEY is not set — rejecting verification");
    return false;
  }
  if (!token || token.length > 4096) return false;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        ...(ip && ip !== "unknown" ? { remoteip: ip } : {}),
      }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!data.success) {
      console.warn("[captcha] verification failed:", data["error-codes"]);
    }
    return data.success === true;
  } catch (err) {
    console.error("[captcha] verification request failed:", err instanceof Error ? err.message : err);
    return false;
  }
}
