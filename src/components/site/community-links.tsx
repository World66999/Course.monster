import { SITE_COMMUNITY_LINKS } from "@/lib/community";
import { TelegramIcon } from "@/components/site/brand-icons";
import { cn } from "@/lib/utils";

/** "Join our Channel" — the public Telegram channel link. */
export function CommunityLinks({ className, size = "md" }: { className?: string; size?: "sm" | "md" }) {
  return (
    <div className={cn("flex flex-wrap gap-2.5", className)}>
      {SITE_COMMUNITY_LINKS.map((l) => (
        <a
          key={l.key}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          data-community={l.key}
          className={cn(
            "inline-flex items-center gap-2 rounded-full bg-[#1878AB] font-semibold whitespace-nowrap text-white shadow-soft",
            "transition-[transform,box-shadow,filter] duration-300 hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            size === "sm" ? "min-h-10 px-3.5 text-sm" : "min-h-11 px-4.5 text-sm sm:text-base"
          )}
        >
          <TelegramIcon className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
          {l.label}
        </a>
      ))}
    </div>
  );
}
