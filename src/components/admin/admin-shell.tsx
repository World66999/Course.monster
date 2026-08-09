"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BookOpen,
  ExternalLink,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Mail,
  MessageCircle,
  MessageSquare,
  Menu,
  PackageSearch,
  PlayCircle,
  Radio,
  Send,
  Settings,
  Users,
  X,
} from "lucide-react";
import { logoutAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { cn } from "@/lib/utils";
import { ADMIN_BASE, adminPath } from "@/lib/admin-path";

const NAV = [
  { href: ADMIN_BASE, label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: adminPath("courses"), label: "Courses", icon: BookOpen },
  { href: adminPath("categories"), label: "Categories", icon: FolderOpen },
  { href: adminPath("moderation"), label: "Moderation", icon: MessageSquare },
  { href: adminPath("chat"), label: "Chat", icon: MessageCircle },
  { href: adminPath("requests"), label: "Requests", icon: Lightbulb },
  { href: adminPath("coding-channels"), label: "Coding Channels", icon: Radio },
  { href: adminPath("learning-resources"), label: "Learning Resources", icon: PlayCircle },
  { href: adminPath("apps"), label: "Apps Hub", icon: PackageSearch },
  { href: adminPath("users"), label: "Users", icon: Users },
  { href: adminPath("pages"), label: "Pages", icon: FileText },
  { href: adminPath("subscribers"), label: "Subscribers", icon: Mail },
  { href: adminPath("telegram"), label: "Telegram Bot", icon: Send },
  { href: adminPath("activity"), label: "Activity", icon: Activity },
  { href: adminPath("settings"), label: "Settings", icon: Settings },
];

export function AdminShell({
  siteName,
  user,
  children,
}: {
  siteName: string;
  user: { name: string; email: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  React.useEffect(() => setSidebarOpen(false), [pathname]);

  const nav = (
    <nav aria-label="Admin" className="flex flex-1 flex-col gap-1 p-4">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
              active
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25 inset-shadow-[0_1px_0_0_rgba(255,255,255,0.15)]"
                : "text-muted-foreground hover:translate-x-0.5 hover:bg-muted hover:text-foreground"
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-4.5 w-4.5" aria-hidden />
            {label}
          </Link>
        );
      })}
      <div className="mt-auto space-y-1 border-t border-border pt-4">
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ExternalLink className="h-4.5 w-4.5" aria-hidden />
          View site
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4.5 w-4.5" aria-hidden />
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border px-6">
          <span className="text-lg font-bold tracking-tight">{siteName}</span>
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-primary uppercase ring-1 ring-primary/15 ring-inset">
            Admin
          </span>
        </div>
        {nav}
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
          <aside className="absolute top-0 left-0 flex h-full w-64 flex-col overflow-y-auto border-r border-border bg-card pb-[env(safe-area-inset-bottom)]">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <span className="font-bold">{siteName}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close sidebar"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-x-0 border-t-0 px-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open sidebar"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="hidden text-right sm:block">
              <p className="text-sm leading-tight font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <span
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent to-primary text-sm font-semibold text-white shadow-sm shadow-primary/30 inset-shadow-[0_1px_0_0_rgba(255,255,255,0.25)]"
            >
              {user.name.trim().charAt(0).toUpperCase() || "A"}
            </span>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
