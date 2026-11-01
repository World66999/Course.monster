"use client";

import Link from "next/link";
import { Crown } from "lucide-react";
import { usePremium } from "@/hooks/use-premium";
import { cn } from "@/lib/utils";

/** Header entry to the Premium tab: "Go Premium" for visitors, a gold crown for members. */
export function PremiumHeaderLink({ className }: { className?: string }) {
  const { me, loading } = usePremium();
  const member = !loading && me.subscribed;
  return (
    <Link
      href="/premium"
      aria-label={member ? "Premium — your membership" : "Go Premium"}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-semibold transition-[transform,box-shadow] duration-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        member
          ? "border border-gold/40 bg-gold-soft text-gold-ink hover:shadow-gold"
          : "bg-gold text-accent-foreground shadow-gold hover:-translate-y-0.5",
        className
      )}
    >
      <Crown className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      <span className="hidden md:inline">{member ? "Premium" : "Go Premium"}</span>
    </Link>
  );
}
