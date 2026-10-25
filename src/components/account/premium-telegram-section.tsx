"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crown, Link2, Loader2, Send, Unlink } from "lucide-react";
import { toast } from "sonner";
import { createTelegramLinkAction, unlinkTelegramAction } from "@/server/actions/premium";
import { safeAction } from "@/lib/safe-action";
import { Button, buttonClasses } from "@/components/ui/button";
import { PremiumNameBadge } from "@/components/premium/crown";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

export function PremiumTelegramSection({
  premiumUntil,
  telegramLinked,
}: {
  premiumUntil: string | null;
  telegramLinked: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const active = premiumUntil !== null && new Date(premiumUntil).getTime() > Date.now();

  async function link() {
    setBusy(true);
    const res = await safeAction(() => createTelegramLinkAction(), "tg-link");
    setBusy(false);
    if (res.ok && "url" in res) {
      window.open(res.url, "_blank", "noopener,noreferrer");
      toast.success("Press Start in Telegram to finish linking. The link works once, for 10 minutes.");
    } else if (!res.ok) toast.error(res.error);
  }

  async function unlink() {
    setBusy(true);
    const res = await safeAction(() => unlinkTelegramAction(), "tg-unlink");
    setBusy(false);
    if (res.ok) {
      toast.success("Telegram unlinked.");
      router.refresh();
    } else toast.error(res.error);
  }

  return (
    <>
      <section className="space-y-4 rounded-card border border-border bg-card p-6 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Crown className="h-5 w-5 text-gold-ink" aria-hidden /> Premium
          </h2>
          {active && <PremiumNameBadge />}
        </div>
        {active ? (
          <p className="text-sm text-muted-foreground">
            Active until <strong className="text-foreground">{DATE.format(new Date(premiumUntil as string))}</strong>.
          </p>
        ) : premiumUntil ? (
          <p className="text-sm text-muted-foreground">
            <span className="mr-1.5 inline-flex rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
              Expired
            </span>
            Your Premium ended on <strong className="text-foreground">{DATE.format(new Date(premiumUntil))}</strong>.
            Renew to keep access.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">You&apos;re on the free plan.</p>
        )}
        <Link
          href={active ? "/premium" : "/premium#plans"}
          className={buttonClasses(active ? "outline" : "accent", "sm", active ? "" : "bg-gold")}
        >
          {active ? "Manage or renew" : premiumUntil ? "Renew Premium" : "Go Premium"}
        </Link>
      </section>

      <section id="telegram" className="scroll-mt-24 space-y-4 rounded-card border border-border bg-card p-6 shadow-soft">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Send className="h-5 w-5 text-primary" aria-hidden /> Telegram
        </h2>
        <p className="text-sm text-muted-foreground">
          Link Telegram to get payment confirmations, expiry reminders and support replies from our
          bot, and to use /mystatus there.
        </p>
        {telegramLinked ? (
          <Button variant="outline" size="sm" onClick={unlink} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Unlink className="h-4 w-4" aria-hidden />}
            Unlink Telegram
          </Button>
        ) : (
          <Button size="sm" onClick={link} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
            Connect Telegram
          </Button>
        )}
      </section>
    </>
  );
}
