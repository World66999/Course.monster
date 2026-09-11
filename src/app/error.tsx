"use client";

import * as React from "react";
import Link from "next/link";
import { Home, RotateCcw, Bug } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";

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
 <div className="relative flex min-h-[60dvh] flex-col items-center justify-center overflow-hidden px-4 py-20 text-center">
 <div className="bg-grid absolute inset-0" aria-hidden />
 <div className="relative">
 <p className="text-gradient font-display text-[clamp(3.5rem,12vw,5.5rem)] leading-none font-bold tracking-[-0.04em]">Oops</p>
 <h1 className="mt-5 text-heading text-balance">Something went wrong</h1>
 <p className="mx-auto mt-3 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
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
 <Button
 variant="outline"
 size="lg"
 onClick={() => {
 const body = encodeURIComponent(
 `Error digest: ${error.digest ?? "none"}\nMessage: ${error.message}\n\nPage: ${typeof window !== "undefined" ? window.location.href : "unknown"}\nTime: ${new Date().toISOString()}`
 );
 window.open(`mailto:support@example.com?subject=Site Error&body=${body}`);
 }}
 >
 <Bug className="h-4 w-4" aria-hidden />
 Report
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
