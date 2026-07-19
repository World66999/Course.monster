"use client";

import * as React from "react";
import Link from "next/link";
import { Home, RotateCcw } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";

/**
 * App-wide error boundary. Keeps the failure on-brand, offers retry
 * (re-renders the segment) and a way home, and logs the digest so server
 * logs can be correlated with what the visitor saw.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[error-boundary]", error.digest ?? "", error);
  }, [error]);

  return (
    <div className="relative flex min-h-[60vh] flex-col items-center justify-center overflow-hidden px-4 py-20 text-center">
      <div className="bg-grid absolute inset-0" aria-hidden />
      <div className="relative">
        <p className="text-gradient text-6xl font-extrabold tracking-tight sm:text-7xl">Oops</p>
        <h1 className="mt-4 text-xl font-bold sm:text-2xl">Something went wrong</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          An unexpected error occurred while loading this page. It has been logged — trying
          again usually fixes it.
          {error.digest && (
            <span className="mt-1 block font-mono text-xs opacity-70">Ref: {error.digest}</span>
          )}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" onClick={reset}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            Try again
          </Button>
          <Link href="/" className={buttonClasses("outline", "lg")}>
            <Home className="h-4 w-4" aria-hidden />
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
