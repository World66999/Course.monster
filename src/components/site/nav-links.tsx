"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from "@/components/ui/dropdown";
import { spring } from "@/lib/motion";
import type { NavEntry } from "@/lib/nav";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

const itemBase =
  "relative inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-control px-2 py-2 text-sm font-medium " +
  "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * The active pill is a single shared `layoutId` element rather than a
 * background class on whichever link is current, so navigating slides the pill
 * from the old item to the new one. It is the one piece of motion in the header
 * and it earns its place: it answers "where am I now" during the transition.
 */
function ActivePill() {
  return (
    <motion.span
      layoutId="nav-active-pill"
      aria-hidden
      className="absolute inset-0 -z-10 rounded-control bg-muted ring-1 ring-inset ring-border"
      transition={spring.crisp}
    />
  );
}

export function NavLinks({ links }: { links: ReadonlyArray<NavEntry> }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

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
                    groupActive ? "text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  {groupActive && !reduce && <ActivePill />}
                  {groupActive && reduce && (
                    <span aria-hidden className="absolute inset-0 -z-10 rounded-control bg-muted ring-1 ring-inset ring-border" />
                  )}
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
              active ? "text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            {active && !reduce && <ActivePill />}
            {active && reduce && (
              <span aria-hidden className="absolute inset-0 -z-10 rounded-control bg-muted ring-1 ring-inset ring-border" />
            )}
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
