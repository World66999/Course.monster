/**
 * Edge-safe (no Node-only imports) — shared by `auth.config.ts`/middleware,
 * server components, and server actions alike.
 */
export type UserRole = "ADMIN" | "EDITOR" | "USER";

/** True for roles allowed into the admin panel. Public commenters are "USER". */
export function isStaff(role: string | undefined | null): boolean {
  return role === "ADMIN" || role === "EDITOR";
}
