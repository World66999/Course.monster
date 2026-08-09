import Image from "next/image";
import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CommentAuthor {
  id: string;
  name: string;
  image: string | null;
  /** Has at least one linked Google Account row — see commentAuthorSelect. */
  accounts: { id: string }[];
}

export function AuthorAvatar({ author, size = 36 }: { author: CommentAuthor; size?: number }) {
  const initials = author.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  if (author.image) {
    return (
      <Image
        src={author.image}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        unoptimized
      />
    );
  }

  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
    >
      {initials || "?"}
    </span>
  );
}

/** "Verified" means signed in with Google, not course verification — labelled accordingly. */
export function VerifiedBadge({ author, className }: { author: CommentAuthor; className?: string }) {
  if (author.accounts.length === 0) return null;
  return (
    <span
      className={cn("inline-flex items-center gap-0.5 text-primary", className)}
      title="Signed in with a verified Google account"
      aria-label="Verified Google account"
    >
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
    </span>
  );
}
