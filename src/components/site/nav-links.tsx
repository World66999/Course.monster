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

const itemBase =
  "relative inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold " +
  "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Static "you are here" pill behind the current item. It used to be a shared
 * framer-motion `layoutId` element that slid between items, but the header is
 * on every page, so that one flourish put the whole motion runtime into every
 * public page's bundle.
 */
function ActivePill() {
  return (
    <span
      aria-hidden
      className="absolute inset-0 -z-10 rounded-full bg-primary-soft ring-1 ring-inset ring-primary/15"
    />
  );
}

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
                    itemBase,
                    "group",
                    groupActive ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {groupActive && <ActivePill />}
                  {link.label}
                  <ChevronDown
                    className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180"
                    aria-hidden
                  />
                </button>
              </DropdownTrigger>
              <DropdownContent align="start">
                {link.children.map((child) => (
                  <DropdownItem key={child.href} asChild>
                    <Link href={child.href} aria-current={isActive(pathname, child.href) ? "page" : undefined} prefetch={false}>
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
            prefetch={false}
            className={cn(
              itemBase,
              active ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {active && <ActivePill />}
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
