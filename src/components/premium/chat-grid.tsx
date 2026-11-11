"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Send } from "lucide-react";
import { toast } from "@/lib/toast";
import type { PublicPremiumChat } from "@/lib/premium-catalog";
import { usePremium } from "@/hooks/use-premium";
import { getPremiumChatInviteAction } from "@/server/actions/premium";
import { safeAction } from "@/lib/safe-action";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { LockedPreview } from "@/components/premium/locked-preview";

export function PremiumChatGrid({ chats }: { chats: PublicPremiumChat[] }) {
  const { me, loading } = usePremium();
  const premium = !loading && me.premium;
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function join(chat: PublicPremiumChat) {
    setBusyId(chat.id);
    const res = await safeAction(() => getPremiumChatInviteAction(chat.id), "premium-invite");
    setBusyId(null);
    if (res.ok && "url" in res) {
      toast.success("One-time invite created — it works once and expires in 15 minutes.");
      window.open(res.url, "_blank", "noopener,noreferrer");
    } else {
      toast.error("error" in res ? res.error : "Couldn't create an invite.");
    }
  }

  if (chats.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-border p-10 text-center text-muted-foreground">
        Members&apos; Telegram groups open soon.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {chats.map((chat) => (
        <article key={chat.id} className="glass-card flex flex-col gap-3 rounded-card p-5">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{chat.category}</Badge>
            <Badge variant="outline">
              <Send aria-hidden />
              Telegram group
            </Badge>
          </div>
          <h3 className="font-display text-[1.0625rem] font-bold">{chat.title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{chat.description}</p>
          <div className="mt-auto pt-1">
            {premium ? (
              <Button variant="outline" size="sm" onClick={() => join(chat)} disabled={busyId === chat.id}>
                {busyId === chat.id && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Get one-time invite
              </Button>
            ) : (
              <LockedPreview lines={2} cta="Unlock with Premium" />
            )}
          </div>
        </article>
      ))}
      {!loading && !premium && (
        <div className="glass-card edge-gold flex flex-col justify-center gap-3 rounded-card p-5 sm:col-span-2 lg:col-span-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold">Members&apos; Telegram groups are part of Premium.</p>
          <Link href="/premium" className={buttonClasses("accent", "md", "bg-gold shadow-gold")}>See Premium</Link>
        </div>
      )}
    </div>
  );
}
