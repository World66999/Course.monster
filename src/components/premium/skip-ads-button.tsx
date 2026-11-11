import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CrownMark } from "@/components/premium/crown";
import { cn } from "@/lib/utils";

/**
 * "Skip ads" offer on the free download path. Links to the plans with the
 * current page as ?next=, which checkout stores with the payment so the buyer
 * comes straight back here — and, now Premium, is sent to the direct link.
 */
export function SkipAdsButton({
  slug,
  className,
  variant = "card",
}: {
  slug: string;
  className?: string;
  /** "compact": a slim pill, for a second offer lower on the same page. */
  variant?: "card" | "compact";
}) {
  const next = `/download/${slug}`;
  if (variant === "compact") {
    return (
      <Link
        href={`/premium?next=${encodeURIComponent(next)}#plans`}
        data-skip-ads
        className={cn(
          "group mx-auto flex min-h-11 w-fit max-w-full items-center gap-2 rounded-full border border-gold/35 bg-gold-soft/70 py-1.5 pr-3.5 pl-1.5 text-sm font-semibold text-gold-ink",
          "transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
          className,
        )}
      >
        <CrownMark size="sm" />
        <span className="truncate">Skip the wait with Premium · from $1</span>
        <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    );
  }
  return (
    <Link
      href={`/premium?next=${encodeURIComponent(next)}#plans`}
      data-skip-ads
      className={cn(
        "group edge-gold flex w-full items-center gap-3 rounded-card border border-gold/40 bg-gold-soft px-4 py-3 text-left",
        "transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
        className,
      )}
    >
      <CrownMark size="md" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-gold-ink sm:text-base">
          Skip ads – Get direct link with Premium
        </span>
        <span className="block text-xs text-muted-foreground sm:text-sm">
          No countdown, no steps, no short links. From $1.
        </span>
      </span>
      <ArrowRight
        className="h-5 w-5 shrink-0 text-gold-ink transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}
