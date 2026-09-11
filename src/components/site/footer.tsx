import Link from "next/link";
import { Send } from "lucide-react";
import type { SiteSettings } from "@/lib/settings-schema";
import { GENERIC_PAGES } from "@/lib/pages";
import { SiteLogo } from "@/components/site/header";
import { NewsletterForm } from "@/components/site/newsletter-form";
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
  "tap-target flex h-9 w-9 items-center justify-center rounded-control border border-border bg-card text-muted-foreground shadow-soft transition-[transform,box-shadow,border-color,color] duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:text-primary hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const footerLinkClass =
  "inline-block rounded-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function FooterHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-4 text-eyebrow text-foreground uppercase">{children}</h3>;
}

export function Footer({ settings }: { settings: SiteSettings }) {
  const socials = Object.entries(SOCIAL_ICONS).filter(
    ([key]) => settings.social[key as keyof typeof SOCIAL_ICONS]
  );

  return (
    <footer className="relative mt-24 overflow-hidden border-t border-border bg-surface-sunken">
      {/* A single hairline of brand colour along the top edge ties the footer
          to the product without turning it into another coloured band. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      />
      {/* 5 columns on desktop: the brand block spans 2, then Explore /
          Free stuff / newsletter take one each. */}
      <div className="page-gutter mx-auto grid max-w-7xl gap-10 py-16 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <SiteLogo settings={settings} />
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            {settings.footerText}
          </p>
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

        <nav aria-label="Footer">
          <FooterHeading>Explore</FooterHeading>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li>
              <Link href="/courses" className={footerLinkClass}>
                All Courses
              </Link>
            </li>
            <li>
              <Link href="/courses?sort=popular" className={footerLinkClass}>
                Most Popular
              </Link>
            </li>
            <li>
              <Link href="/courses?sort=newest" className={footerLinkClass}>
                Recently Added
              </Link>
            </li>
            <li>
              <Link href="/how-to-download" className={footerLinkClass}>
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
        <nav aria-label="Free sections">
          <FooterHeading>Free stuff</FooterHeading>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li>
              <Link href="/free-resources" className={footerLinkClass}>
                Free Resources
              </Link>
            </li>
            <li>
              <Link href="/ai-platforms" className={footerLinkClass}>
                Free AI Platforms
              </Link>
            </li>
            <li>
              <Link href="/apps" className={footerLinkClass}>
                Apps Hub
              </Link>
            </li>
            <li>
              <Link href="/learn" className={footerLinkClass}>
                Free Learning
              </Link>
            </li>
            <li>
              <Link href="/coding-channels" className={footerLinkClass}>
                Coding Channels
              </Link>
            </li>
          </ul>
        </nav>

        {settings.newsletterEnabled && (
          <div>
            <FooterHeading>Stay updated</FooterHeading>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              Get notified when new courses are added.
            </p>
            <NewsletterForm />
          </div>
        )}
      </div>
      <div className="border-t border-border">
        <div className="page-gutter mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 py-6 sm:flex-row sm:items-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {settings.siteName}. All rights reserved.
          </p>
          <nav aria-label="Legal">
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
              {GENERIC_PAGES.map((page) => (
                <li key={page.slug}>
                  <Link href={page.path} className={footerLinkClass}>
                    {page.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
