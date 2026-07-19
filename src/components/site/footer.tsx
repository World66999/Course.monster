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

export function Footer({ settings }: { settings: SiteSettings }) {
  const socials = Object.entries(SOCIAL_ICONS).filter(
    ([key]) => settings.social[key as keyof typeof SOCIAL_ICONS]
  );

  return (
    <footer className="mt-24 border-t border-border bg-card/50">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="space-y-4 lg:col-span-2">
          <SiteLogo settings={settings} />
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            {settings.footerText}
          </p>
          {(socials.length > 0 || settings.telegramUrl) && (
            <div className="flex items-center gap-2 pt-1">
              {settings.telegramUrl && (
                <a
                  href={settings.telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Telegram"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:text-primary hover:shadow-elevated"
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
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:text-primary hover:shadow-elevated"
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </a>
              ))}
            </div>
          )}
        </div>

        <nav aria-label="Footer">
          <h3 className="mb-4 text-sm font-semibold tracking-wide uppercase">Explore</h3>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li>
              <Link href="/courses" className="transition-colors hover:text-primary">
                All Courses
              </Link>
            </li>
            <li>
              <Link href="/courses?sort=popular" className="transition-colors hover:text-primary">
                Most Popular
              </Link>
            </li>
            <li>
              <Link href="/courses?sort=newest" className="transition-colors hover:text-primary">
                Recently Added
              </Link>
            </li>
            <li>
              <Link href="/how-to-download" className="transition-colors hover:text-primary">
                How to Download
              </Link>
            </li>
          </ul>
        </nav>

        {settings.newsletterEnabled && (
          <div>
            <h3 className="mb-4 text-sm font-semibold tracking-wide uppercase">Stay updated</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Get notified when new courses are added.
            </p>
            <NewsletterForm />
          </div>
        )}
      </div>
      <div className="border-t border-border py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {settings.siteName}. All rights reserved.
          </p>
          <nav aria-label="Legal">
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
              {GENERIC_PAGES.map((page) => (
                <li key={page.slug}>
                  <Link href={page.path} className="transition-colors hover:text-primary">
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
