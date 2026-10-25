import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 text-center">
      <div className="bg-grid absolute inset-0" aria-hidden />
      <div
        aria-hidden
        className="absolute top-1/3 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[110px]"
      />
      <div className="relative">
        <p className="text-gradient font-display text-[clamp(5rem,18vw,9rem)] leading-none font-bold tracking-[-0.04em]">404</p>
        <h1 className="mt-5 text-heading text-balance">This page took a day off</h1>
        <p className="mx-auto mt-3 max-w-md text-pretty text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved. Let&apos;s get
          you back to learning.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className={buttonClasses("primary", "lg")}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back home
          </Link>
          <Link href="/courses" className={buttonClasses("outline", "lg")}>
            <Compass className="h-4 w-4" aria-hidden />
            Browse courses
          </Link>
        </div>
      </div>
    </div>
  );
}
