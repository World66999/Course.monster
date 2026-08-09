"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from "@/components/ui/dropdown";
import type { NavEntry } from "@/lib/nav";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Header nav links with an active pill so visitors always know where they are. Entries with `children` render as a dropdown. */
export function NavLinks({ links }: { links: ReadonlyArray<NavEntry> }) {
  const pathname = usePathname();
  return (
    <>
      {links.map((link) => {
        if ("children" in link) {
          const groupActive = link.children.some((c) => isActive(pathname, c.href));
          return (
            <Dropdown key={link.label}>
              <DropdownTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    groupActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  )}
                >
                  {link.label}
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                </button>
              </DropdownTrigger>
              <DropdownContent align="start">
                {link.children.map((child) => (
                  <DropdownItem key={child.href} asChild>
                    <Link href={child.href} aria-current={isActive(pathname, child.href) ? "page" : undefined}>
                      {child.label}
                    </Link>
                  </DropdownItem>
                ))}
              </DropdownContent>
            </Dropdown>
          );
        }

        const active = isActive(pathname, link.href);
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
