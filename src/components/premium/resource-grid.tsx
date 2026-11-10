"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Lock, Unlock } from "lucide-react";
import { toast } from "@/lib/toast";
import type { PublicPremiumCategory } from "@/lib/premium-catalog";
import { usePremium } from "@/hooks/use-premium";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Markdown } from "@/components/site/markdown";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { LockedPreview } from "@/components/premium/locked-preview";
import { PremiumIcon } from "@/components/premium/premium-icon";
import { cn } from "@/lib/utils";

type Item = PublicPremiumCategory["resources"][number];

interface Unlocked {
  content: string;
  openUrl: string | null;
}

function ResourceCard({ item, premium, onOpen }: { item: Item; premium: boolean; onOpen: (item: Item) => void }) {
  return (
    <article className="glass-card flex flex-col gap-3 rounded-card p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-[1.0625rem] leading-snug font-bold">{item.title}</h3>
        {premium ? (
          <Unlock className="mt-0.5 h-4 w-4 shrink-0 text-gold-ink" aria-label="Unlocked" />
        ) : (
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-gold-ink" aria-label="Locked" />
        )}
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{item.summary}</p>
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.tags.slice(0, 4).map((t) => (
            <Badge key={t} variant="secondary">{t}</Badge>
          ))}
        </div>
      )}
      <div className="mt-auto pt-1">
        {premium ? (
          <Button variant="outline" size="sm" onClick={() => onOpen(item)}>
            Open
          </Button>
        ) : (
          <LockedPreview lines={3} />
        )}
      </div>
    </article>
  );
}

export function PremiumResourceGrid({ categories }: { categories: PublicPremiumCategory[] }) {
  const { me, loading } = usePremium();
  const premium = !loading && me.premium;
  const [active, setActive] = React.useState<string>("all");
  const [open, setOpen] = React.useState<Item | null>(null);
  const [data, setData] = React.useState<Unlocked | null>(null);
  const [busy, setBusy] = React.useState(false);

  const visible = categories.filter((c) => c.resources.length > 0 && (active === "all" || c.slug === active));

  async function openItem(item: Item) {
    setOpen(item);
    setData(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/premium/resources/${item.id}`, { cache: "no-store" });
      if (!res.ok) {
        toast.error(res.status === 403 ? "This needs an active Premium membership." : "Couldn't load this resource.");
        setOpen(null);
        return;
      }
      setData((await res.json()) as Unlocked);
    } catch {
      toast.error("Couldn't load this resource.");
      setOpen(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-8 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Categories">
        {[{ slug: "all", name: "All", icon: "layers" }, ...categories.filter((c) => c.resources.length > 0)].map((c) => (
          <button
            key={c.slug}
            type="button"
            role="tab"
            aria-selected={active === c.slug}
            onClick={() => setActive(c.slug)}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active === c.slug
                ? "border-gold/50 bg-gold-soft text-gold-ink"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            <PremiumIcon name={c.icon} className="h-4 w-4" />
            {c.name}
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="rounded-card border border-dashed border-border p-10 text-center text-muted-foreground">
          New Premium Resources are on the way.
        </p>
      )}

      <div className="space-y-12">
        {visible.map((cat) => (
          <section key={cat.id} aria-labelledby={`cat-${cat.slug}`}>
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-nested bg-primary-soft text-primary ring-1 ring-inset ring-primary/20">
                <PremiumIcon name={cat.icon} className="h-5 w-5" />
              </span>
              <div>
                <h2 id={`cat-${cat.slug}`} className="text-subheading">{cat.name}</h2>
                {cat.description && <p className="text-sm text-muted-foreground">{cat.description}</p>}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cat.resources.map((item) => (
                <ResourceCard key={item.id} item={item} premium={premium} onOpen={openItem} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {!loading && !premium && (
        <div className="glass-card edge-gold mt-12 flex flex-wrap items-center justify-between gap-4 rounded-panel p-6">
          <p className="font-semibold">Unlock every guide, project list and roadmap with Premium.</p>
          <Link href="/premium" className={buttonClasses("accent", "md", "bg-gold shadow-gold")}>
            See Premium
          </Link>
        </div>
      )}

      <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto">
          <DialogTitle className="text-heading">{open?.title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">{open?.summary}</DialogDescription>
          {busy && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
            </div>
          )}
          {data && (
            <div className="mt-4 space-y-6">
              <Markdown content={data.content} />
              {data.openUrl && (
                <a
                  href={data.openUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClasses("primary", "md")}
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  Open resource
                </a>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
