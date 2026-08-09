"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { LogOut, Menu, Send, User as UserIcon, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { SiteSettings } from "@/lib/settings-schema";
import { NAV_LINKS } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button";
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
        <Button variant="ghost" size="icon" aria-label="Open menu" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </DialogPrimitive.Trigger>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount>
              <motion.div
                className="fixed top-0 right-0 z-50 h-dvh w-72 overflow-y-auto border-l border-border bg-card p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl focus:outline-none"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "tween", duration: reduce ? 0 : 0.25, ease: "easeOut" }}
              >
                <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
                <div className="mb-6 flex items-center justify-between">
                  <span className="font-bold">{settings.siteName}</span>
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
                        <p className="px-3 py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                          {link.label}
                        </p>
                        {link.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              "block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted",
                              pathname === child.href ? "bg-muted text-primary" : "text-foreground"
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
                          "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted",
                          pathname === link.href ? "bg-muted text-primary" : "text-foreground"
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
                <div className="mt-6 space-y-2 border-t border-border pt-6">
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
