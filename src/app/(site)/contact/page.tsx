import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Send, ShieldCheck, ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { CONTACT_EMAIL, getPageMeta } from "@/lib/pages";
import { getSiteSettings } from "@/lib/settings";
import { formatDate } from "@/lib/utils";
import { Section } from "@/components/site/section";
import { Markdown } from "@/components/site/markdown";
import { buttonClasses } from "@/components/ui/button";

export const revalidate = 300;

const meta = getPageMeta("contact")!;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Contact Us",
    description: meta.description,
    alternates: { canonical: meta.path },
  };
}

const cardClass = "surface flex h-full flex-col rounded-feature p-6 sm:p-8";
const iconClass =
  "mb-5 flex h-12 w-12 shrink-0 items-center justify-center rounded-nested bg-primary/10 text-primary";

/**
 * Dedicated route rather than the generic [slug] page so the business email is
 * always shown as a proper call to action, whatever the admin-edited Markdown
 * says. That Markdown (Admin → Pages → Contact) still renders below the cards
 * for the longer "which channel for what" detail.
 *
 * There is deliberately no form: the address is a Cloudflare Email Routing
 * forward, which receives mail but cannot send it, so a form would need a
 * separate outbound mail provider. mailto: hands the message to the visitor's
 * own mail client instead.
 */
export default async function ContactPage() {
  const [settings, page] = await Promise.all([
    getSiteSettings(),
    db.page.findUnique({ where: { slug: "contact" } }),
  ]);

  return (
    <>
      <Section className="pt-20 pb-10 text-center sm:pt-28 sm:pb-14">
        <div className="mx-auto mb-8 flex max-w-fit items-center justify-center gap-2 rounded-full bg-primary-soft px-5 py-2 ring-1 ring-inset ring-primary/20">
          <Mail className="h-4 w-4 text-primary" aria-hidden />
          <span className="text-eyebrow text-primary uppercase">Contact</span>
        </div>
        <h1 className="text-display mb-6 text-balance">Get in touch</h1>
        <p className="text-lead mx-auto max-w-2xl text-balance text-muted-foreground">
          Business enquiries, partnerships, copyright matters or feedback — we read every message
          and reply as soon as we can.
        </p>
      </Section>

      <Section rhythm="none" className="pb-16">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          <div className={`${cardClass} md:col-span-2 md:flex-row md:items-center md:gap-8`}>
            <div className="min-w-0 flex-1">
              <div className={iconClass}>
                <Mail className="h-6 w-6" aria-hidden />
              </div>
              <h2 className="text-heading mb-2">Email us</h2>
              <p className="mb-6 text-pretty text-muted-foreground md:mb-0">
                The best way to reach the team for business, partnerships, copyright and DMCA
                requests, or anything else.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center md:flex-col md:items-start">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className={buttonClasses("primary", "lg", "w-full sm:w-auto")}
              >
                <Mail className="h-4 w-4" aria-hidden />
                Send an email
              </a>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="min-w-0 break-all rounded-sm font-medium text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {CONTACT_EMAIL}
              </a>
            </div>
          </div>

          {settings.telegramUrl && (
            <div className={cardClass}>
              <div className={iconClass}>
                <Send className="h-6 w-6" aria-hidden />
              </div>
              <h2 className="mb-2 text-lg font-semibold">Telegram channel</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Follow along for new courses and site updates.
              </p>
              <a
                href={settings.telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses("outline", "md", "mt-auto w-full")}
              >
                Join on Telegram
              </a>
            </div>
          )}
          <div className={cardClass}>
            <div className={iconClass}>
              <ShieldCheck className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="mb-2 text-lg font-semibold">Copyright &amp; DMCA</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Read what to include before sending a takedown request.
            </p>
            <Link
              href="/copyright"
              prefetch={false}
              className={buttonClasses("outline", "md", "mt-auto w-full")}
            >
              Copyright policy
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </Section>

      {page && (
        <Section rhythm="none" className="max-w-3xl pb-8">
          <Markdown content={page.content} />
          <p className="mt-8 text-sm text-muted-foreground">
            Last updated {formatDate(page.updatedAt)}
          </p>
        </Section>
      )}
    </>
  );
}
