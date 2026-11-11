import Link from "next/link";
import { GraduationCap, Send } from "lucide-react";
import type { SiteSettings } from "@/lib/settings-schema";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { LazyMobileNav, LazySearchDialog } from "@/components/site/lazy-widgets";
import { NavLinks } from "@/components/site/nav-links";
import { StickyHeader } from "@/components/site/sticky-header";
import { UserMenu } from "@/components/site/user-menu";
import { buttonClasses } from "@/components/ui/button";
import { PremiumHeaderLink } from "@/components/premium/header-link";
import { SavedLink } from "@/components/site/library-views";

import { NAV_LINKS } from "@/lib/nav";

export function SiteLogo({ settings, className }: { settings: SiteSettings; className?: string }) {
  return (
    // `w-fit`: as a block-level flex in the footer this link stretched the full
    // width of its column, so ~300px of empty space beside the wordmark silently
    // navigated home. `tap-target` covers the other half of the problem — with a
    // custom logo the row is only 28px tall, which is a poor thumb target even
    // though it is very wide.
    <Link
      href="/"
      className={`group tap-target flex w-fit min-w-0 items-center gap-2 rounded-control min-[400px]:gap-2.5 font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${className ?? ""}`}
    >
      {settings.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={settings.logoUrl} alt="" className="h-7 w-auto shrink-0" />
      ) : (
        // Brand-gradient tile with a citrus spark: the one place all the brand
        // hues meet, so the palette reads as deliberate from the first glance.
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[0.75rem] bg-brand min-[400px]:h-9 min-[400px]:w-9 min-[400px]:rounded-[0.8rem] text-white shadow-primary inset-shadow-highlight transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-rotate-6 group-hover:scale-110">
          <span
            aria-hidden
            className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-accent ring-2 ring-white/40"
          />
          <GraduationCap className="relative h-5 w-5" aria-hidden />
        </span>
      )}
      <span className="font-display truncate whitespace-nowrap text-base font-extrabold tracking-[-0.035em] min-[400px]:text-lg">
        {settings.siteName}
      </span>
    </Link>
  );
}

export function AnnouncementBar({ settings }: { settings: SiteSettings }) {
  const { announcement } = settings;
  if (!announcement.enabled || !announcement.text) return null;
  return (
    <div className="bg-brand relative overflow-hidden text-white">
      <p className="page-gutter relative mx-auto max-w-7xl py-2 text-center text-sm font-medium">
        {announcement.text}
        {announcement.linkUrl && (
          <a
            href={announcement.linkUrl}
            className="ml-2 inline-flex items-center rounded-full bg-white/15 px-2.5 py-0.5 font-semibold ring-1 ring-inset ring-white/25 transition-[background-color] duration-300 hover:bg-white/25"
            target="_blank"
            rel="noopener noreferrer"
          >
            {announcement.linkLabel || "Learn more"}
          </a>
        )}
      </p>
    </div>
  );
}

export function Header({ settings }: { settings: SiteSettings }) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:rounded-control focus:bg-primary focus:px-4 focus:py-2 focus:font-medium focus:text-primary-foreground focus:shadow-elevated"
      >
        Skip to content
      </a>
      <AnnouncementBar settings={settings} />
      <StickyHeader>
        <div className="flex h-16 items-center justify-between gap-2 px-[max(0.75rem,env(safe-area-inset-left))] sm:gap-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3 xl:gap-5">
            <SiteLogo settings={settings} className="min-w-0 xl:shrink-0" />
            <nav aria-label="Main" className="hidden items-center gap-1 xl:flex">
              {/* The logo is the home link on wide screens; dropping the
                  duplicate "Home" item keeps the row clear of the actions. */}
              <NavLinks links={NAV_LINKS.filter((l) => !("href" in l && l.href === "/"))} />
            </nav>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1.5">
            <PremiumHeaderLink className="px-2.5 sm:mr-1 sm:px-3" />
            <LazySearchDialog />
            {/* From 480px: below that it would squeeze the site name; the phone
                menu carries the same link. */}
            <SavedLink className="hidden min-[480px]:inline-flex" />
            <ThemeToggle />
            <div className="hidden sm:block">
              <UserMenu />
            </div>
            {settings.telegramUrl && (
              <a
                href={settings.telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram"
                className={buttonClasses("primary", "sm", "ml-1 hidden sm:inline-flex")}
              >
                <Send className="h-3.5 w-3.5" aria-hidden />
                {/* Labelled only while the nav is collapsed (lg). The bar is
                    capped at max-w-7xl, so wider screens have no more room
                    than xl does and a label there ran under the nav. */}
                <span className="hidden lg:inline xl:hidden">Telegram</span>
              </a>
            )}
            <LazyMobileNav settings={settings} />
          </div>
        </div>
      </StickyHeader>
    </>
  );
}
