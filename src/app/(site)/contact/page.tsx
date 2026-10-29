import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Crown, Send, ShieldCheck } from "lucide-react";
import { getPageMeta } from "@/lib/pages";
import { supportTelegram } from "@/lib/razorpay-config";
import { getSiteSettings } from "@/lib/settings";
import { Section } from "@/components/site/section";
import { buttonClasses } from "@/components/ui/button";

export const revalidate = 300;

const meta = getPageMeta("contact")!;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: meta.path },
  };
}

const cardClass = "surface flex h-full flex-col rounded-feature p-6 sm:p-8";
const iconClass =
  "mb-5 flex h-12 w-12 shrink-0 items-center justify-center rounded-nested bg-primary/10 text-primary";

/**
 * Telegram is the only contact channel shown anywhere on the site: the
 * handle comes from SUPPORT_TELEGRAM. No email address, phone number or
 * postal address is published.
 */
export default async function ContactPage() {
  const settings = await getSiteSettings();
  const support = supportTelegram();

  return (
    <>
      <Section className="pt-20 pb-10 text-center sm:pt-28 sm:pb-14">
        <div className="mx-auto mb-8 flex max-w-fit items-center justify-center gap-2 rounded-full bg-primary-soft px-5 py-2 ring-1 ring-inset ring-primary/20">
          <Send className="h-4 w-4 text-primary" aria-hidden />
          <span className="text-eyebrow text-primary uppercase">Contact</span>
        </div>
        <h1 className="text-display mb-6 text-balance">Get in touch</h1>
        <p className="text-lead mx-auto max-w-2xl text-balance text-muted-foreground">
          Support, payments, partnerships, copyright matters or feedback — message us on Telegram
          and we&apos;ll reply as soon as we can.
        </p>
      </Section>

      <Section rhythm="none" className="pb-16">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          <div className={`${cardClass} md:col-span-2 md:flex-row md:items-center md:gap-8`}>
            <div className="min-w-0 flex-1">
              <div className={iconClass}>
                <Send className="h-6 w-6" aria-hidden />
              </div>
              <h2 className="text-heading mb-2">Message us on Telegram</h2>
              <p className="mb-6 text-pretty text-muted-foreground md:mb-0">
                The one place to reach the team — for help with downloads or Premium, payment
                questions (please include your payment ID), business and copyright requests.
              </p>
            </div>
            {support ? (
              <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center md:flex-col md:items-start">
                <a
                  href={support.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClasses("primary", "lg", "w-full sm:w-auto")}
                >
                  <Send className="h-4 w-4" aria-hidden />
                  Open Telegram
                </a>
                <a
                  href={support.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-sm font-medium text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {support.handle}
                </a>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Our Telegram contact will be listed here shortly.</p>
            )}
          </div>

          <div className={cardClass}>
            <div className={iconClass}>
              <Crown className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="mb-2 text-lg font-semibold">Premium members</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Signed in? Open a private ticket in Premium Purchase Support — Premium tickets are
              answered first.
            </p>
            <Link href="/premium/support" prefetch={false} className={buttonClasses("outline", "md", "mt-auto w-full")}>
              Premium Purchase Support
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div className={cardClass}>
            <div className={iconClass}>
              <ShieldCheck className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="mb-2 text-lg font-semibold">Copyright &amp; DMCA</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Read what to include before sending a takedown request.
            </p>
            <Link href="/copyright" prefetch={false} className={buttonClasses("outline", "md", "mt-auto w-full")}>
              Copyright policy
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          {settings.telegramUrl && (
            <div className={`${cardClass} md:col-span-2`}>
              <h2 className="mb-2 text-lg font-semibold">Telegram channel</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Follow along for new courses and site updates.
              </p>
              <a
                href={settings.telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses("outline", "md", "w-full sm:w-auto")}
              >
                Join the channel
              </a>
            </div>
          )}
        </div>
      </Section>
    </>
  );
}
