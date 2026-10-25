import type { Metadata } from "next";
import Link from "next/link";
import {
  Ban,
  Check,
  Gem,
  GraduationCap,
  LifeBuoy,
  MessagesSquare,
  Minus,
  Zap,
} from "lucide-react";
import { absoluteUrl } from "@/lib/utils";
import { PLANS } from "@/lib/premium-plans";
import { Section, SectionHeading } from "@/components/site/section";
import { Reveal } from "@/components/site/reveal";
import { buttonClasses } from "@/components/ui/button";
import { CrownMark } from "@/components/premium/crown";
import { PlansOrAccount, SecureBadge } from "@/components/premium/plan-cards";

export const metadata: Metadata = {
  title: "Premium — Instant Downloads, Premium Courses & Members' Chats",
  description:
    "Courses Monster Premium: instant downloads with no timers or ads, premium courses, curated Premium Resources, members-only chats and priority support. $1 a month or $10 a year.",
  alternates: { canonical: "/premium" },
  openGraph: { title: "Courses Monster Premium", url: absoluteUrl("/premium") },
};

/** Static: the plan/account island fetches the viewer's own state on the client. */
export const revalidate = 3600;

const BENEFITS = [
  {
    icon: Zap,
    title: "Instant downloads",
    body: "Tap download and go. No countdown, no verification steps, no ad-supported short links in between.",
  },
  {
    icon: Ban,
    title: "No ads anywhere",
    body: "Every ad-supported step on the site is switched off for your account, everywhere, for as long as you're a member.",
  },
  {
    icon: GraduationCap,
    title: "Premium courses",
    body: "Courses marked Premium unlock for you the moment your payment is confirmed.",
  },
  {
    icon: Gem,
    title: "Premium Resources",
    body: "Hand-written guides: coding help, getting the most out of AI tools, curated GitHub projects, learning roadmaps and free alternatives to paid apps.",
  },
  {
    icon: MessagesSquare,
    title: "Members-only chats",
    body: "Smaller, moderated rooms where members help each other — plus private Telegram groups with single-use invites.",
  },
  {
    icon: LifeBuoy,
    title: "Priority support",
    body: "Your tickets are flagged Priority and answered first.",
  },
];

const COMPARISON: { feature: string; free: string | boolean; premium: string | boolean }[] = [
  { feature: "Browse the full course catalogue", free: true, premium: true },
  { feature: "Download free courses", free: "Countdown + verification", premium: "Instant" },
  { feature: "Ads on the download path", free: "Yes", premium: "None" },
  { feature: "Premium courses", free: false, premium: true },
  { feature: "Premium Resources", free: "Titles only", premium: "Full access" },
  { feature: "Members-only chats", free: false, premium: true },
  { feature: "Support", free: "Standard", premium: "Priority" },
  { feature: "Premium badge on your name", free: false, premium: true },
];

const FAQ = [
  {
    q: "How do I pay?",
    a: "With crypto, through NOWPayments' hosted checkout. You pick a coin, send the exact amount shown, and Premium switches on automatically once the network confirms the payment. We never see or store your wallet keys.",
  },
  {
    q: "Which coins can I use?",
    a: "Low-fee coins whose minimum payment is below the plan price — currently options such as USDT on BNB Smart Chain, Litecoin and TRON. The checkout checks the live minimums before showing each coin, and tells you plainly if one isn't available for your plan.",
  },
  {
    q: "How long does activation take?",
    a: "Usually a few minutes — it depends on the blockchain's confirmation time. You'll see it on the success page, and if you've linked Telegram, the bot messages you the moment it's active.",
  },
  {
    q: "What happens if I renew early?",
    a: "The new period is added on top of your current expiry date. Renewing a day early or a month early, you never lose time you've already paid for.",
  },
  {
    q: "Does it renew automatically?",
    a: "No. Crypto payments are one-off, so nothing is ever charged without you. We send a reminder 3 days and 1 day before your Premium ends (via Telegram, once linked).",
  },
  {
    q: "Can I pay another way, or I have a payment problem?",
    a: "Open a ticket in Premium Purchase Support. Tickets are private between you and our team.",
  },
];

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="mx-auto h-5 w-5 text-gold-ink" aria-label="Included" />;
  if (value === false) return <Minus className="mx-auto h-5 w-5 text-muted-foreground/60" aria-label="Not included" />;
  return <span>{value}</span>;
}

export default function PremiumPage() {
  return (
    <>
      {/* Hero */}
      <Section rhythm="none" className="relative pt-14 pb-12 text-center sm:pt-20 sm:pb-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-24 bottom-0 -z-10 bg-[radial-gradient(40rem_20rem_at_50%_0%,var(--wash-1),transparent_70%),radial-gradient(26rem_14rem_at_75%_30%,var(--wash-4),transparent_70%)]"
        />
        <div className="rise-in flex justify-center">
          <CrownMark size="lg" />
        </div>
        <p className="rise-in mt-6 text-eyebrow text-gold-ink uppercase" style={{ "--d": "40ms" } as React.CSSProperties}>
          Courses Monster Premium
        </p>
        <h1
          className="rise-in mx-auto mt-3 max-w-3xl text-display text-balance"
          style={{ "--d": "80ms" } as React.CSSProperties}
        >
          Learn without the <span className="text-gold-gradient">wait</span>.
        </h1>
        <p
          className="rise-in mx-auto mt-5 max-w-2xl text-lead text-pretty text-muted-foreground"
          style={{ "--d": "120ms" } as React.CSSProperties}
        >
          Instant downloads, premium courses, hand-written resources and members-only chats — for $
          {PLANS.MONTHLY.priceUsd} a month, or ${PLANS.YEARLY.priceUsd} for the whole year.
        </p>
        <div
          className="rise-in mt-8 flex flex-wrap items-center justify-center gap-3"
          style={{ "--d": "160ms" } as React.CSSProperties}
        >
          <a href="#plans" className={buttonClasses("accent", "lg", "bg-gold shadow-gold")}>
            See plans
          </a>
          <Link href="/premium-resources" className={buttonClasses("outline", "lg")}>
            Preview Premium Resources
          </Link>
        </div>
        <div className="rise-in mt-6 flex justify-center" style={{ "--d": "200ms" } as React.CSSProperties}>
          <SecureBadge />
        </div>
      </Section>

      {/* Benefits */}
      <Section rhythm="tight">
        <SectionHeading eyebrow="What you get" title="Everything Premium includes" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b, i) => (
            <Reveal key={b.title} delay={i * 0.04} className="glass-card rounded-card p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-nested bg-primary-soft text-primary ring-1 ring-inset ring-primary/20">
                <b.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-subheading">{b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.body}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Comparison */}
      <Section rhythm="tight">
        <SectionHeading eyebrow="Compare" title="Free vs Premium" />
        <div className="glass-card overflow-x-auto rounded-panel">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-4 text-left font-medium text-muted-foreground">Feature</th>
                <th className="w-36 p-4 text-center font-semibold">Free</th>
                <th className="w-36 bg-gold-soft/60 p-4 text-center font-semibold text-gold-ink">Premium</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.feature} className="border-b border-border last:border-0">
                  <td className="p-4">{row.feature}</td>
                  <td className="p-4 text-center text-muted-foreground">
                    <Cell value={row.free} />
                  </td>
                  <td className="bg-gold-soft/30 p-4 text-center font-medium">
                    <Cell value={row.premium} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Plans / account */}
      <Section rhythm="tight" id="plans" className="scroll-mt-24">
        <SectionHeading eyebrow="Plans" title="Pick your plan" align="center" />
        <PlansOrAccount />
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <SecureBadge />
          <p className="max-w-xl text-sm text-muted-foreground">
            One-off payments — nothing renews by itself. Want to pay another way or have a payment
            problem?{" "}
            <Link href="/premium/support" className="font-medium text-primary underline underline-offset-2">
              Premium Purchase Support
            </Link>
          </p>
        </div>
      </Section>

      {/* FAQ */}
      <Section rhythm="tight" className="pb-20">
        <SectionHeading eyebrow="FAQ" title="Questions, answered" />
        <div className="mx-auto max-w-3xl space-y-3">
          {FAQ.map((item) => (
            <details key={item.q} className="glass-card group rounded-card p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {item.q}
                <span
                  aria-hidden
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-transform duration-300 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </Section>
    </>
  );
}
