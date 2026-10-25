/**
 * Client-side wrapper for invoking a server action.
 *
 * A server action can *reject* rather than resolve — the action never gets to
 * return its `{ ok: false, error }` shape at all. That happens when:
 *
 *   - the session stopped being valid (requireAdmin()/requireUser() throw by
 *     design, so the authorization boundary fails closed — never weaken that),
 *   - the browser still holds a client bundle from a previous deployment, so
 *     the action id no longer exists server-side ("Failed to find Server
 *     Action" — observed in production),
 *   - the request itself fails (network drop, 5xx, restart mid-request).
 *
 * Without this wrapper those rejections were unhandled: the button appeared to
 * do nothing, the pending state could stay stuck, and the rejection surfaced as
 * an uncaught error. This converts them into the same `{ ok, error }` result the
 * actions already return, so every call site keeps its existing logic.
 *
 * There is a fourth case, specific to the public toggle actions (vote,
 * bookmark, like, follow): they read the existing row and then create or
 * delete it, so two taps racing each other make the loser's transaction fail
 * on the unique constraint (P2002) or the vanished row (P2025). Prisma throws
 * that out of the action, which on a phone — where a double-tap is normal —
 * is a routine event, not an exceptional one.
 *
 * This does NOT swallow the failure: the full error is still logged to the
 * console with context for diagnosis, and the user always gets a truthful,
 * actionable message.
 *
 * Named for what it does rather than where it is used: it was originally
 * admin-only, but every public component that calls a server action needs
 * exactly the same protection and several were going without it.
 */

export interface ActionResultLike {
  ok: boolean;
  error?: string;
}

/** Recognises the stale-bundle case so we can tell the admin to reload rather than showing a generic failure. */
function isStaleDeploymentError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return (
    message.includes("Failed to find Server Action") ||
    message.includes("Connection closed") ||
    message.includes("Failed to fetch")
  );
}

export function describeActionError(err: unknown): string {
  if (isStaleDeploymentError(err)) {
    return "This page is out of date (the site was updated, or the connection dropped). Reload the page and try again.";
  }
  return "That didn't go through. Your session may have expired — reload the page and try again.";
}

/**
 * Runs an admin server action and always resolves. Never throws.
 * Returns the action's own result on success, or a synthesized failure result.
 */
export async function safeAction<T extends ActionResultLike>(
  fn: () => Promise<T>,
  context?: string
): Promise<T | { ok: false; error: string }> {
  try {
    return await fn();
  } catch (err) {
    // Keep the real error visible for diagnosis — this is not suppression.
    console.error(`[action]${context ? ` ${context}:` : ""} request failed`, err);
    return { ok: false, error: describeActionError(err) };
  }
}
