"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Bookmark, LogOut, Menu, Send, User as UserIcon, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { SiteSettings } from "@/lib/settings-schema";
import { NAV_LINKS } from "@/lib/nav";
import { Button, buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MobileNav({ settings }: { settings: SiteSettings }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu" className="xl:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[oklch(0.16_0.03_270_/_0.5)] data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in" />
        {/* Slides in from the right (transform only); Radix keeps it mounted
            until the closing animation ends. Links then rise in sequence via
            `rise-in` + a per-item `--d`. Reduced motion collapses both.
            `pr` picks up the right-hand safe-area inset: the drawer is pinned to
            the right edge, and with `viewport-fit=cover` a notched iPhone in
            landscape can put the notch or home indicator over exactly that edge. */}
        <DialogPrimitive.Content className="glass-panel fixed top-0 right-0 z-50 flex h-dvh w-[min(21rem,90vw)] flex-col overflow-y-auto *:shrink-0 rounded-l-panel rounded-r-none border-y-0 border-r-0 p-6 shadow-floating data-[state=closed]:animate-drawer-out data-[state=open]:animate-drawer-in pr-[max(1.5rem,env(safe-area-inset-right))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] focus:outline-none">
                <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
                <div className="mb-6 flex items-center justify-between">
                  <span className="font-display text-subheading">{settings.siteName}</span>
                  <DialogPrimitive.Close asChild>
                    <Button variant="ghost" size="icon" aria-label="Close menu">
                      <X className="h-5 w-5" />
                    </Button>
                  </DialogPrimitive.Close>
                </div>
                <nav aria-label="Mobile" className="flex flex-col gap-1">
                  {NAV_LINKS.map((link, i) =>
                    "children" in link ? (
                      <div
                        key={link.label}
                        className="rise-in py-1"
                        style={{ "--d": `${80 + i * 45}ms` } as React.CSSProperties}
                      >
                        <p className="px-3 pt-2 pb-1 text-eyebrow text-muted-foreground uppercase">
                          {link.label}
                        </p>
                        {link.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              "block rounded-control px-3 py-3 text-base font-semibold transition-[background-color,color,transform] duration-300 hover:translate-x-1 hover:bg-muted",
                              pathname === child.href
                                ? "bg-primary-soft text-primary ring-1 ring-inset ring-primary/20"
                                : "text-foreground"
                            )}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <Link
                        key={link.href}
                        href={link.href}
                        style={{ "--d": `${80 + i * 45}ms` } as React.CSSProperties}
                        className={cn(
                          "rise-in rounded-control px-3 py-3 text-base font-semibold transition-[background-color,color,transform] duration-300 hover:translate-x-1 hover:bg-muted",
                          pathname === link.href
                            ? "bg-primary-soft text-primary ring-1 ring-inset ring-primary/20"
                            : "text-foreground"
                        )}
                      >
                        {link.label}
                      </Link>
                    )
                  )}
                </nav>
                <Link
                  href="/saved"
                  className={cn(
                    "mt-2 flex items-center gap-2 rounded-control px-3 py-3 text-base font-semibold transition-[background-color,color] duration-300 hover:bg-muted",
                    pathname === "/saved" ? "bg-primary-soft text-primary ring-1 ring-inset ring-primary/20" : "text-foreground"
                  )}
                >
                  <Bookmark className="h-4.5 w-4.5" aria-hidden />
                  Saved &amp; recently viewed
                </Link>
                {settings.telegramUrl && (
                  <a
                    href={settings.telegramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClasses("brand", "md", "mt-6 w-full")}
                  >
                    <Send className="h-4 w-4" aria-hidden />
                    Join Telegram
                  </a>
                )}
                <div className="mt-auto space-y-2 border-t border-border pt-6">
                  {session?.user ? (
                    <>
                      <Link href="/account" className={buttonClasses("outline", "md", "w-full")}>
                        <UserIcon className="h-4 w-4" aria-hidden />
                        Account
                      </Link>
                      <button
                        type="button"
                        onClick={() => void signOut({ callbackUrl: "/" })}
                        className={buttonClasses("ghost", "md", "w-full text-destructive")}
                      >
                        <LogOut className="h-4 w-4" aria-hidden />
                        Sign out
                      </button>
                    </>
                  ) : (
                    <>
                      <Link href="/login" className={buttonClasses("outline", "md", "w-full")}>
                        Sign in
                      </Link>
                      <Link href="/signup" className={buttonClasses("ghost", "md", "w-full")}>
                        Create account
                      </Link>
                    </>
                  )}
                </div>
              </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
