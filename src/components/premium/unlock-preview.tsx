import Link from "next/link";
import { ArrowRight, Gem } from "lucide-react";
import type { PublicPremiumCategory } from "@/lib/premium-catalog";
import { LockedPreview } from "@/components/premium/locked-preview";
import { buttonClasses } from "@/components/ui/button";

/**
 * A taste of Premium Resources: real titles and summaries (already public on
 * /premium-resources) with the body locked. Renders nothing when there are no
 * published resources, so the page never advertises an empty library.
 */
export function UnlockPreview({ categories, limit = 3 }: { categories: PublicPremiumCategory[]; limit?: number }) {
  // One resource per category first, so the preview shows the range.
  const picks: { category: string; id: string; title: string; summary: string | null }[] = [];
  for (let round = 0; picks.length < limit; round++) {
    let added = false;
    for (const c of categories) {
      const r = c.resources[round];
      if (!r || picks.length >= limit) continue;
      picks.push({ category: c.name, id: r.id, title: r.title, summary: r.summary });
      added = true;
    }
    if (!added) break;
  }
  if (picks.length === 0) return null;
  const total = categories.reduce((n, c) => n + c.resources.length, 0);

  return (
    <div>
      <ul className="grid gap-4 md:grid-cols-3">
        {picks.map((r) => (
          <li key={r.id} className="glass-card flex flex-col rounded-card p-5">
            <p className="inline-flex items-center gap-1.5 text-eyebrow text-gold-ink uppercase">
              <Gem className="h-3.5 w-3.5" aria-hidden />
              {r.category}
            </p>
            <h3 className="mt-2 font-semibold leading-snug text-balance">{r.title}</h3>
            {r.summary && <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{r.summary}</p>}
            <LockedPreview lines={3} className="mt-4" href="#plans" cta="Unlock with Premium" />
          </li>
        ))}
      </ul>
      <div className="mt-6 flex justify-center">
        <Link href="/premium-resources" className={buttonClasses("outline", "md")}>
          Browse all {total} titles <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
