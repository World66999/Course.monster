import "server-only";
import { auth } from "@/auth";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
  }
}

/**
 * Server-side guard for every admin action and admin data loader.
 * Middleware already protects /admin routes; this is defense in depth so
 * server actions can never be invoked without a valid admin session.
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError();
  return session.user;
}
