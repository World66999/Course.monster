/**
 * The admin panel's URL segment.
 *
 * The panel lives at a cryptographically random, non-guessable path as a
 * defence-in-depth layer on top of authentication — it is obscurity, not a
 * replacement for the auth checks in `middleware.ts`, the panel layout, and
 * `requireAdmin()` in every server action.
 *
 * This value must stay identical to the directory name under `src/app/`,
 * because the App Router derives the URL from the filesystem. It is therefore
 * a build-time constant rather than an environment variable (see the note in
 * `middleware.ts` about statically-analysed matchers).
 *
 * Server-only by convention: it is imported by admin routes/components, which
 * are never bundled into public pages. Do not import it from `(site)` code.
 */
export const ADMIN_SEGMENT =
  "nQHjIM9lWjRdNkwJR7ZQATYmcCAJJ0lmquyuSNZTdYsj3bX5aP0usQfCoYfFm5Vq";

/** Base path of the admin panel, e.g. `/<segment>`. */
export const ADMIN_BASE = `/${ADMIN_SEGMENT}` as const;

/** Login page path. */
export const ADMIN_LOGIN_PATH = `${ADMIN_BASE}/login` as const;

/** Build a path inside the admin panel: adminPath("courses/new"). */
export function adminPath(subPath = ""): string {
  const clean = subPath.replace(/^\/+/, "");
  return clean ? `${ADMIN_BASE}/${clean}` : ADMIN_BASE;
}
