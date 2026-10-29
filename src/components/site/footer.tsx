import Link from "next/link";
import { Send } from "lucide-react";
import type { SiteSettings } from "@/lib/settings-schema";
import { GENERIC_PAGES } from "@/lib/pages";
import { supportTelegram } from "@/lib/razorpay-config";
import { SiteLogo } from "@/components/site/header";
import { NewsletterForm } from "@/components/site/newsletter-form";
import { CommunityLinks } from "@/components/site/community-links";
import {
  DiscordIcon,
  FacebookIcon,
  GithubIcon,
  InstagramIcon,
  XTwitterIcon,
  YoutubeIcon,
} from "@/components/site/brand-icons";

const SOCIAL_ICONS = {
  twitter: { icon: XTwitterIcon, label: "Twitter / X" },
  youtube: { icon: YoutubeIcon, label: "YouTube" },
  github: { icon: GithubIcon, label: "GitHub" },
  instagram: { icon: InstagramIcon, label: "Instagram" },
  facebook: { icon: FacebookIcon, label: "Facebook" },
  discord: { icon: DiscordIcon, label: "Discord" },
} as const;

const socialLinkClass =
  "tap-target flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-soft transition-[transform,box-shadow,border-color,color,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const footerLinkClass =
  "link-underline inline-block rounded-sm transition-colors duration-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    // h2: on most pages the footer follows the page's h1 directly, so an h3
    // here skipped a level.
    <h2 className="mb-5 flex items-center gap-2 text-eyebrow text-foreground uppercase">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
      {children}
    </h2>
  );
}

export function Footer({ settings }: { settings: SiteSettings }) {
  const support = supportTelegram();
  const socials = Object.entries(SOCIAL_ICONS).filter(
    ([key]) => settings.social[key as keyof typeof SOCIAL_ICONS]
  );

  return (
    <footer className="page-gutter mx-auto mt-16 w-full max-w-7xl pb-[max(1rem,env(safe-area-inset-bottom))] sm:mt-24">
      {/* One raised rounded panel instead of a full-bleed grey band: the footer
          reads as a designed object that closes the page. */}
      <div className="@container relative isolate overflow-hidden rounded-feature border border-border bg-surface-sunken">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_18rem_at_0%_0%,var(--wash-1),transparent_70%),radial-gradient(30rem_16rem_at_100%_100%,var(--wash-3),transparent_70%)]"
        />
        {/* 12-track grid on desktop: brand 4, Explore 2, Free stuff 2,
            newsletter 4. With equal fifths the newsletter field was squeezed
            to a few characters beside its button. */}
        <div className="grid gap-10 px-6 py-12 sm:grid-cols-2 sm:px-10 sm:py-14 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-4">
            <SiteLogo settings={settings} />
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              {settings.footerText}
            </p>
            {support && (
              <div className="text-sm">
                <p className="mb-1 text-muted-foreground">Support &amp; contact</p>
                <a
                  href={support.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${footerLinkClass} inline-flex items-center gap-2 font-medium text-foreground`}
                >
                  <Send className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span>{support.handle}</span>
                </a>
              </div>
            )}
            <div className="pt-1 text-sm">
              <p className="mb-2 text-muted-foreground">Talk courses with everyone on Telegram</p>
              <CommunityLinks size="sm" />
            </div>
            {(socials.length > 0 || settings.telegramUrl) && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {settings.telegramUrl && (
                  <a
                    href={settings.telegramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Telegram"
                    className={socialLinkClass}
                  >
                    <Send className="h-4 w-4" aria-hidden />
                  </a>
                )}
                {socials.map(([key, { icon: Icon, label }]) => (
                  <a
                    key={key}
                    href={settings.social[key as keyof typeof SOCIAL_ICONS]}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className={socialLinkClass}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </a>
                ))}
              </div>
            )}
          </div>

          <nav aria-label="Footer" className="lg:col-span-2">
            <FooterHeading>Explore</FooterHeading>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <Link href="/courses" className={footerLinkClass} prefetch={false}>
                  All Courses
                </Link>
              </li>
              <li>
                <Link href="/courses?sort=popular" className={footerLinkClass} prefetch={false}>
                  Most Popular
                </Link>
              </li>
              <li>
                <Link href="/courses?sort=newest" className={footerLinkClass} prefetch={false}>
                  Recently Added
                </Link>
              </li>
              <li>
                <Link href="/how-to-download" className={footerLinkClass} prefetch={false}>
                  How to Download
                </Link>
              </li>
            </ul>
          </nav>

          {/*
            These five live in header dropdowns, whose contents Radix only mounts
            once opened — so none of them had a server-rendered internal link
            anywhere on the site, and a crawler could reach them only via the
            sitemap. Listing them here gives every section a real <a> in the
            initial HTML, on every page.
          */}
          <nav aria-label="Free sections" className="lg:col-span-2">
            <FooterHeading>Free stuff</FooterHeading>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <Link href="/free-resources" className={footerLinkClass} prefetch={false}>
                  Free Resources
                </Link>
              </li>
              <li>
                <Link href="/ai-platforms" className={footerLinkClass} prefetch={false}>
                  Free AI Platforms
                </Link>
              </li>
              <li>
                <Link href="/apps" className={footerLinkClass} prefetch={false}>
                  Apps Hub
                </Link>
              </li>
              <li>
                <Link href="/learn" className={footerLinkClass} prefetch={false}>
                  Free Learning
                </Link>
              </li>
              <li>
                <Link href="/coding-channels" className={footerLinkClass} prefetch={false}>
                  Coding Channels
                </Link>
              </li>
            </ul>
          </nav>

          {settings.newsletterEnabled && (
            <div className="lg:col-span-4">
              <FooterHeading>Stay updated</FooterHeading>
              <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                Get notified when new courses are added.
              </p>
              <NewsletterForm />
            </div>
          )}
        </div>
        {/* Oversized wordmark. Decorative only; the real name is in the logo.
            Sized in container-query units so the whole name spans the panel
            at every width instead of being cut off with an ellipsis. */}
        <p
          aria-hidden
          className="font-display pointer-events-none -mb-[0.22em] overflow-hidden px-4 text-center text-[11cqw] leading-none font-extrabold tracking-[-0.06em] whitespace-nowrap text-transparent select-none [-webkit-text-stroke:1px_var(--border-strong)] opacity-40"
        >
          {settings.siteName}
        </p>
        <div className="relative border-t border-border bg-surface-sunken">
          <div className="flex flex-col items-start justify-between gap-3 px-6 py-6 sm:flex-row sm:items-center sm:px-10">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} {settings.siteName}. All rights reserved.
            </p>
            <nav aria-label="Legal">
              <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
                {GENERIC_PAGES.map((page) => (
                  <li key={page.slug}>
                    <Link href={page.path} className={footerLinkClass} prefetch={false}>
                      {page.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
