import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Compass, Search } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

const SHORTCUTS = [
  { href: "/courses", label: "All courses" },
  { href: "/courses?sort=popular", label: "Most downloaded" },
  { href: "/premium", label: "Premium" },
  { href: "/how-to-download", label: "How to download" },
  { href: "/contact", label: "Contact" },
];

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
      <div className="bg-grid absolute inset-0" aria-hidden />
      {/* A gradient, not a blur filter: same glow, no GPU blur layer. */}
      <div
        aria-hidden
        className="absolute top-1/4 left-1/2 h-80 w-[40rem] max-w-[140vw] -translate-x-1/2 bg-[radial-gradient(closest-side,var(--wash-1),transparent)]"
      />
      <div className="relative w-full max-w-lg">
        <p className="rise-in text-gradient font-display text-[clamp(5rem,22vw,9rem)] leading-none font-extrabold tracking-[-0.04em]">
          404
        </p>
        <h1 className="rise-in mt-4 text-heading text-balance" style={{ "--d": "60ms" } as React.CSSProperties}>
          This page took a day off
        </h1>
        <p
          className="rise-in mx-auto mt-3 max-w-md text-pretty text-muted-foreground"
          style={{ "--d": "120ms" } as React.CSSProperties}
        >
          The link may be old or mistyped. Search for the course you wanted, or jump back in below.
        </p>

        {/* Plain GET form: works without JavaScript. */}
        <form
          action="/courses"
          method="get"
          role="search"
          className="rise-in relative mx-auto mt-7 max-w-md"
          style={{ "--d": "180ms" } as React.CSSProperties}
        >
          <label htmlFor="nf-search" className="sr-only">
            Search courses
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            id="nf-search"
            name="q"
            type="search"
            placeholder="Search courses"
            autoComplete="off"
            enterKeyHint="search"
            maxLength={100}
            className="h-13 w-full rounded-full border border-input bg-card pr-28 pl-12 text-base shadow-soft focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none"
          />
          <button type="submit" className={buttonClasses("brand", "md", "absolute top-1/2 right-1.5 -translate-y-1/2 hover:-translate-y-1/2 active:-translate-y-1/2")}>
            Search
          </button>
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className={buttonClasses("primary", "lg")}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back home
          </Link>
          <Link href="/courses" className={buttonClasses("outline", "lg")}>
            <Compass className="h-4 w-4" aria-hidden />
            Browse courses
          </Link>
        </div>

        <nav aria-label="Popular pages" className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm">
          {SHORTCUTS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="inline-flex min-h-11 items-center font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
            >
              {s.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
