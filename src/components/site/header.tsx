import Link from "next/link";
import { GraduationCap, Send } from "lucide-react";
import type { SiteSettings } from "@/lib/settings-schema";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { SearchDialog } from "@/components/site/search-dialog";
import { MobileNav } from "@/components/site/mobile-nav";
import { NavLinks } from "@/components/site/nav-links";
import { UserMenu } from "@/components/site/user-menu";
import { NotificationBell } from "@/components/site/notification-bell";
import { buttonClasses } from "@/components/ui/button";

import { NAV_LINKS } from "@/lib/nav";

export function SiteLogo({ settings, className }: { settings: SiteSettings; className?: string }) {
  return (
    <Link href="/" className={`flex min-w-0 items-center gap-2 font-bold tracking-tight ${className ?? ""}`}>
      {settings.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={settings.logoUrl} alt="" className="h-7 w-auto shrink-0" />
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-primary text-white shadow-sm shadow-primary/30 inset-shadow-[0_1px_0_0_rgba(255,255,255,0.25)]">
          <GraduationCap className="h-5 w-5" aria-hidden />
        </span>
      )}
      <span className="truncate text-lg">{settings.siteName}</span>
    </Link>
  );
}

export function AnnouncementBar({ settings }: { settings: SiteSettings }) {
  const { announcement } = settings;
  if (!announcement.enabled || !announcement.text) return null;
  return (
    <div className="bg-gradient-to-r from-accent to-primary px-4 py-2 text-center text-sm font-medium text-white">
      {announcement.text}
      {announcement.linkUrl && (
        <a
          href={announcement.linkUrl}
          className="ml-2 underline underline-offset-2 hover:opacity-90"
          target="_blank"
          rel="noopener noreferrer"
        >
          {announcement.linkLabel || "Learn more"}
        </a>
      )}
    </div>
  );
}

export function Header({ settings }: { settings: SiteSettings }) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <AnnouncementBar settings={settings} />
      <header className="glass sticky top-0 z-40 border-x-0 border-t-0">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-8">
            <SiteLogo settings={settings} className="min-w-0" />
            <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
              <NavLinks links={NAV_LINKS} />
            </nav>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-2">
            <SearchDialog />
            <NotificationBell />
            <ThemeToggle />
            <div className="hidden sm:block">
              <UserMenu />
            </div>
            {settings.telegramUrl && (
              <a
                href={settings.telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses("primary", "sm", "hidden sm:inline-flex")}
              >
                <Send className="h-3.5 w-3.5" aria-hidden />
                Telegram
              </a>
            )}
            <MobileNav settings={settings} />
          </div>
        </div>
      </header>
    </>
  );
}
