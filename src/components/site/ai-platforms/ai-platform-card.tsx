import { ArrowUpRight, ExternalLink, Info, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cardClasses } from "@/components/ui/card";
import { hostnameOf } from "@/lib/external-resource";
import {
  AI_CATEGORY_LABELS,
  AI_PRICING_LABELS,
  AI_PRICING_VARIANTS,
  labelFor,
} from "@/lib/directory-labels";
import { cn, gradientFromString } from "@/lib/utils";

export interface AiPlatformCardDTO {
  id: string;
  name: string;
  description: string | null;
  url: string;
  category: string;
  pricingType: string;
  freeTierNote: string | null;
  logo: string | null;
  tags: string[];
  featured: boolean;
}

function PlatformLogo({ name, logo }: { name: string; logo: string | null }) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" className="h-12 w-12 shrink-0 rounded-nested object-cover" loading="lazy" />;
  }
  const { from, to, light } = gradientFromString(name);
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[a-zA-Z0-9]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-nested"
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
      aria-hidden
    >
      <span className={cn("text-base font-bold", light ? "text-slate-900/85" : "text-white/90")}>{initials}</span>
    </div>
  );
}

/**
 * Links straight to the platform's official site — no proxy, no embed, no
 * intermediate redirect — with `rel="noopener noreferrer"` for the same
 * reverse-tabnabbing reason as the Free Resources card.
 *
 * The pricing badge is rendered from AI_PRICING_LABELS keyed by the row's
 * enum; no wording is written here, so a claim can be corrected without
 * touching this component. `freeTierNote` is admin text rendered as a normal
 * text node — React escapes it, and nothing on this page uses
 * dangerouslySetInnerHTML.
 */
export function AiPlatformCard({ platform }: { platform: AiPlatformCardDTO }) {
  const host = hostnameOf(platform.url);

  return (
    <a
      href={platform.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cardClasses("gap-3 p-4")}
    >
      <div className="flex items-start gap-3">
        <PlatformLogo name={platform.name} logo={platform.logo} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-card-foreground group-hover:text-primary">{platform.name}</h3>
          {host && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
              {host}
            </p>
          )}
        </div>
      </div>

      {platform.description && (
        <p className="line-clamp-2 text-sm text-muted-foreground">{platform.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {platform.featured && (
          <Badge variant="warning">
            <Sparkles className="h-3 w-3" aria-hidden />
            Featured
          </Badge>
        )}
        <Badge variant={AI_PRICING_VARIANTS[platform.pricingType] ?? "secondary"}>
          {labelFor(AI_PRICING_LABELS, platform.pricingType)}
        </Badge>
        <Badge variant="outline">{labelFor(AI_CATEGORY_LABELS, platform.category)}</Badge>
      </div>

      {platform.freeTierNote && (
        <p className="flex items-start gap-1.5 rounded-control bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{platform.freeTierNote}</span>
        </p>
      )}

      {platform.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {platform.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs font-medium text-primary">
        <span>Visit official website</span>
        <span className="inline-flex items-center gap-1">
          <span className="sr-only">(opens {platform.name} in a new tab, leaving Courses Monster)</span>
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
        </span>
      </div>
    </a>
  );
}
