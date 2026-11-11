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
  Link2,
  Sparkles,
  CloudDownload,
  Settings,
  Users,
  X,
  Crown,
  Gem,
  LifeBuoy,
  MessagesSquare,
  CreditCard,
  Wallet,
} from "lucide-react";
import { logoutAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { cn } from "@/lib/utils";
import { ADMIN_BASE, adminPath } from "@/lib/admin-path";

/**
 * Grouped, so 24 destinations read as five short lists instead of one long
 * one. Order inside a group follows how often a section is used.
 */
const NAV_GROUPS: { label: string; items: { href: string; label: string; icon: typeof Activity; exact?: boolean }[] }[] = [
  {
    label: "Overview",
    items: [{ href: ADMIN_BASE, label: "Dashboard", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "Catalogue",
    items: [
      { href: adminPath("courses"), label: "Courses", icon: BookOpen },
      { href: adminPath("categories"), label: "Categories", icon: FolderOpen },
      { href: adminPath("coding-channels"), label: "Coding Channels", icon: Radio },
      { href: adminPath("learning-resources"), label: "Learning Resources", icon: PlayCircle },
      { href: adminPath("apps"), label: "Apps Hub", icon: PackageSearch },
      { href: adminPath("free-resources"), label: "Free Resources", icon: Link2 },
      { href: adminPath("ai-platforms"), label: "AI Platforms", icon: Sparkles },
    ],
  },
  {
    label: "Premium & payments",
    items: [
      { href: adminPath("payments"), label: "All Payments", icon: Wallet },
      { href: adminPath("razorpay"), label: "Razorpay", icon: CreditCard },
      { href: adminPath("premium"), label: "NOWPayments", icon: Crown, exact: true },
      { href: adminPath("premium-resources"), label: "Premium Resources", icon: Gem },
      { href: adminPath("premium-chats"), label: "Premium Chats", icon: MessagesSquare },
      { href: adminPath("support"), label: "Support Inbox", icon: LifeBuoy },
    ],
  },
  {
    label: "People",
    items: [
      { href: adminPath("users"), label: "Users", icon: Users },
      { href: adminPath("moderation"), label: "Moderation", icon: MessageSquare },
      { href: adminPath("chat"), label: "Chat", icon: MessageCircle },
      { href: adminPath("requests"), label: "Requests", icon: Lightbulb },
      { href: adminPath("subscribers"), label: "Subscribers", icon: Mail },
    ],
  },
  {
    label: "Site",
    items: [
      { href: adminPath("telegram"), label: "Telegram Bot", icon: Send },
      { href: adminPath("social-downloader"), label: "Social Downloader", icon: CloudDownload },
      { href: adminPath("pages"), label: "Pages", icon: FileText },
      { href: adminPath("activity"), label: "Activity", icon: Activity },
      { href: adminPath("settings"), label: "Settings", icon: Settings },
    ],
  },
];
const NAV = NAV_GROUPS.flatMap((g) => g.items);

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

  // The public site's drawer is a Radix dialog and gets this for free; this one
  // is hand-rolled, so it had none of it: Escape did nothing, and the page
  // behind kept scrolling under the open drawer. Both only apply while open.
  React.useEffect(() => {
    if (!sidebarOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen]);

  const nav = (
    <nav aria-label="Admin" className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="mb-2">
          <p className="px-3 pt-2 pb-1 text-[0.6875rem] font-bold tracking-[0.1em] text-muted-foreground/80 uppercase">
            {group.label}
          </p>
          {group.items.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                // No prefetch. Left on, every admin page load fetched all ~25
                // sections in the background. Besides the wasted work, each of
                // those responses re-issues the session cookie, so one arriving
                // just after "Sign out" signed the admin straight back in.
                prefetch={false}
                className={cn(
                  "relative flex min-h-10 items-center gap-3 rounded-control px-3 py-2 text-sm font-medium",
                  "transition-[background-color,color,box-shadow] duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                  active
                    ? "bg-primary text-primary-foreground shadow-primary inset-shadow-highlight"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden />
                {label}
              </Link>
            );
          })}
        </div>
      ))}
      <div className="mt-auto space-y-1 border-t border-border pt-4">
        <Link prefetch={false}
          href="/"
          target="_blank"
          className="flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          <ExternalLink className="h-4.5 w-4.5" aria-hidden />
          View site
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full cursor-pointer items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
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
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            className="absolute top-0 left-0 flex h-full w-72 max-w-[86vw] animate-[drawer-in-left_0.28s_var(--ease-emphasis)] flex-col overflow-y-auto border-r border-border bg-card pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]"
          >
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
        <header className="glass-chrome sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-x-0 border-t-0 px-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open sidebar"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <p className="min-w-0 flex-1 truncate font-display text-base font-bold lg:hidden">
            {NAV.find((n) => (n.exact ? pathname === n.href : pathname === n.href || pathname.startsWith(`${n.href}/`)))?.label ?? "Admin"}
          </p>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="hidden text-right sm:block">
              <p className="text-sm leading-tight font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <span
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet to-primary text-sm font-semibold text-white shadow-sm shadow-primary/30 inset-shadow-[0_1px_0_0_rgba(255,255,255,0.25)]"
            >
              {user.name.trim().charAt(0).toUpperCase() || "A"}
            </span>
          </div>
        </header>
        <main id="main-content" className="min-w-0 flex-1 p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
