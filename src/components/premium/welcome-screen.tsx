import Link from "next/link";
import { ArrowRight, CheckCircle2, Gem, LifeBuoy, Send, Zap } from "lucide-react";
import { CrownMark } from "@/components/premium/crown";
import { buttonClasses } from "@/components/ui/button";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const UNLOCKED = [
  { icon: Zap, title: "Instant downloads", body: "No countdowns, steps or ads.", href: "/courses" },
  { icon: Gem, title: "Premium Resources", body: "Every guide, in full.", href: "/premium-resources" },
  { icon: Send, title: "Private Telegram groups", body: "Single-use invite links.", href: "/premium-chats" },
  { icon: LifeBuoy, title: "Priority support", body: "Your tickets are answered first.", href: "/premium/support" },
] as const;

/** Shown once a payment (Razorpay or crypto) is confirmed by the server. */
export function PremiumWelcome({ planName, expiresAt }: { planName: string; expiresAt: Date | null }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="rise-in flex justify-center">
        <CrownMark size="lg" />
      </div>
      <h1 className="rise-in mt-6 text-title" style={{ "--d": "40ms" } as React.CSSProperties}>
        Welcome to <span className="text-gold-gradient">Premium</span>
      </h1>
      <p
        className="rise-in mt-4 inline-flex items-center gap-2 rounded-full border border-success/25 bg-success-soft px-4 py-1.5 text-sm font-semibold text-success"
        style={{ "--d": "80ms" } as React.CSSProperties}
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden /> Payment confirmed — {planName} plan
      </p>
      {expiresAt && (
        <p className="mt-3 text-muted-foreground">
          Active until <strong className="text-foreground">{DATE.format(expiresAt)}</strong>. Nothing renews by itself.
        </p>
      )}

      <h2 className="mt-10 text-left text-eyebrow text-gold-ink uppercase">Unlocked for you</h2>
      <ul className="mt-3 grid gap-3 text-left sm:grid-cols-2">
        {UNLOCKED.map(({ icon: Icon, title, body, href }) => (
          <li key={title}>
            <Link
              href={href}
              className="glass-card group flex h-full items-start gap-3 rounded-card p-4 transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-nested bg-gold-soft text-gold-ink ring-1 ring-inset ring-gold/25">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2 font-semibold">
                  {title}
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{body}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/premium-resources" className={buttonClasses("accent", "lg", "bg-gold shadow-gold")}>
          Open Premium Resources
        </Link>
        <Link href="/courses" className={buttonClasses("outline", "lg")}>
          Browse courses
        </Link>
      </div>
    </div>
  );
}
