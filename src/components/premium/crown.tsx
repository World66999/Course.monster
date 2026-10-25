import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

/** The gold crown tile — the single Premium mark used everywhere on the site. */
export function CrownMark({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-6 w-6 rounded-[0.5rem] [&>svg]:h-3.5 [&>svg]:w-3.5", md: "h-10 w-10 rounded-[0.8rem] [&>svg]:h-5 [&>svg]:w-5", lg: "h-14 w-14 rounded-2xl [&>svg]:h-7 [&>svg]:w-7" } as const;
  return (
    <span
      aria-hidden
      className={cn(
        "bg-gold inline-flex shrink-0 items-center justify-center text-accent-foreground shadow-gold inset-shadow-highlight",
        sizes[size],
        className
      )}
    >
      <Crown strokeWidth={2.25} />
    </span>
  );
}

/** Inline badge shown next to a Premium member's name. */
export function PremiumNameBadge({ className }: { className?: string }) {
  return (
    <span
      title="Premium member"
      className={cn(
        "gold-sheen inline-flex h-4.5 items-center gap-0.5 rounded-full px-1.5 text-[10px] font-bold tracking-wide text-accent-foreground uppercase",
        className
      )}
    >
      <Crown className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
      <span>Premium</span>
    </span>
  );
}
