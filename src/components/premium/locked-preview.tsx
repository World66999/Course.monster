import Link from "next/link";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * What a free visitor sees in place of locked content: blurred placeholder
 * bars (not the real text — that never reaches their browser), a gold lock,
 * and the way in.
 */
export function LockedPreview({
  lines = 4,
  className,
  cta = "Unlock with Premium",
  href = "/premium",
}: {
  lines?: number;
  className?: string;
  cta?: string;
  href?: string;
}) {
  const widths = ["w-11/12", "w-9/12", "w-10/12", "w-7/12", "w-8/12", "w-6/12"];
  return (
    <div className={cn("relative overflow-hidden rounded-nested border border-gold/25 bg-muted/40", className)}>
      <div className="locked-preview space-y-2.5 p-4" aria-hidden>
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className={cn("h-2.5 rounded-full bg-muted-foreground/35", widths[i % widths.length])} />
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-gradient-to-b from-transparent via-background/30 to-background/70 p-3 text-center">
        <span className="bg-gold flex h-9 w-9 items-center justify-center rounded-full text-accent-foreground shadow-gold">
          <Lock className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        </span>
        <Link
          href={href}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-gold/45 bg-gold-soft px-3.5 text-xs font-semibold text-gold-ink transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}
