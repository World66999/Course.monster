"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Header nav links with an active pill so visitors always know where they are. */
export function NavLinks({
  links,
}: {
  links: ReadonlyArray<{ href: string; label: string }>;
}) {
  const pathname = usePathname();
  return (
    <>
      {links.map((link) => {
        const active =
          link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
