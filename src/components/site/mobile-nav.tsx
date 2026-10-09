"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { LogOut, Menu, Send, User as UserIcon, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { duration, ease, spring, transition } from "@/lib/motion";
import type { SiteSettings } from "@/lib/settings-schema";
import { NAV_LINKS } from "@/lib/nav";
import { Button, buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MobileNav({ settings }: { settings: SiteSettings }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const reduce = useReducedMotion();

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
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-[oklch(0.13_0.02_285_/_0.55)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : duration.fast, ease: ease.standard }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount>
              <motion.div
                // `pr` picks up the right-hand safe-area inset: the drawer is
                // pinned to the right edge, and with `viewport-fit=cover` a notched
                // iPhone in landscape can put the notch or the home indicator over
                // exactly that edge.
                className="glass-panel fixed top-0 right-0 z-50 flex h-dvh w-[min(20rem,88vw)] flex-col overflow-y-auto rounded-none border-y-0 border-r-0 p-6 pr-[max(1.5rem,env(safe-area-inset-right))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] focus:outline-none"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                // Enter on the heavy spring — a full-height surface should feel
                // weighty arriving. Exit on a short accelerating curve instead:
                // lib/motion.ts states the rule ("exits run at ~65% of their
                // enter duration, so dismissal feels immediate") but this drawer
                // used `spring.heavy` in both directions, so tapping Close or
                // pressing Escape left it drifting off screen for well over half
                // a second — measured still mounted at 500ms, gone by 700ms. A
                // transition on the exit target overrides the shared one for that
                // direction only, so no extra state is needed to tell them apart.
                exit={{ x: "100%", transition: reduce ? { duration: 0 } : transition.exit }}
                transition={reduce ? { duration: 0 } : spring.heavy}
              >
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
                  {NAV_LINKS.map((link) =>
                    "children" in link ? (
                      <div key={link.label} className="py-1">
                        <p className="px-3 pt-2 pb-1 text-eyebrow text-muted-foreground uppercase">
                          {link.label}
                        </p>
                        {link.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              "block rounded-control px-3 py-3 text-sm font-medium transition-colors hover:bg-muted",
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
                        className={cn(
                          "rounded-control px-3 py-3 text-sm font-medium transition-colors hover:bg-muted",
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
                {settings.telegramUrl && (
                  <a
                    href={settings.telegramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClasses("primary", "md", "mt-6 w-full")}
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
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
