import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { LoginForm } from "@/components/auth/login-form";
import { safeInternalPath } from "@/lib/safe-url";

export const metadata: Metadata = {
  title: "Sign in",
  alternates: { canonical: "/login" },
  robots: { index: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const session = await auth();
  if (session?.user?.id) {
    // A disabled account's JWT stays technically valid until it naturally
    // expires (sessions are stateless), so this must re-check the DB, not
    // just "is there a session" — otherwise a disabled user bounces
    // straight back here from /account (which correctly redirects them to
    // /login), producing an infinite redirect loop between the two pages.
    const user = await db.user.findUnique({ where: { id: session.user.id }, select: { disabled: true } });
    if (user && !user.disabled) {
      // Honour ?next= (validated same-site path) so "Buy" -> login -> checkout
      // also works for someone who was already signed in.
      const { next } = await searchParams;
      const target = safeInternalPath(Array.isArray(next) ? next[0] : next);
      redirect(target === "/" ? "/account" : target);
    }
  }

  // The fallback reserves exactly the AuthCard's own height. Without one the
  // boundary streamed in empty, the footer painted mid-screen and was then
  // shoved off it when the card arrived — a 0.75 CLS on a throttled phone.
  return (
    <Suspense fallback={<div aria-hidden className="min-h-[calc(100dvh-4rem)]" />}>
      <LoginForm />
    </Suspense>
  );
}
