"use client";

import { useSession, signIn } from "next-auth/react";
import { LogIn } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** Gates children behind a Google sign-in — used by the comment/review forms. */
export function SignInGate({
  children,
  prompt,
}: {
  children: React.ReactNode;
  prompt: string;
}) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <Skeleton className="h-11 w-full rounded-nested" />;
  }

  if (!session?.user) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-muted/30 p-6 text-center">
        <p className="text-sm text-muted-foreground">{prompt}</p>
        <button
          type="button"
          onClick={() => void signIn("google")}
          className={buttonClasses("primary", "md")}
        >
          <LogIn className="h-4 w-4" aria-hidden />
          Sign in with Google
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
