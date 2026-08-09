"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminPath } from "@/lib/admin-path";
import { cn } from "@/lib/utils";

const TABS = [
  { href: adminPath("telegram"), label: "Overview", exact: true },
  { href: adminPath("telegram/users"), label: "Users" },
  { href: adminPath("telegram/broadcasts"), label: "Broadcast & analytics" },
  { href: adminPath("telegram/logs"), label: "Logs" },
];

export function TelegramTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
