import { ArrowUpRight, ExternalLink, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cardClasses } from "@/components/ui/card";
import { hostnameOf } from "@/lib/external-resource";
import { RESOURCE_CATEGORY_LABELS, RESOURCE_SOURCE_LABELS, labelFor } from "@/lib/directory-labels";
import { cn, gradientFromString } from "@/lib/utils";
import { UploadPicture } from "@/components/site/upload-picture";

export interface FreeResourceCardDTO {
  id: string;
  title: string;
  description: string | null;
  url: string;
  sourceType: string;
  category: string;
  thumbnail: string | null;
  tags: string[];
  featured: boolean;
}

function ResourceThumb({ title, thumbnail }: { title: string; thumbnail: string | null }) {
  if (thumbnail) {
    return <UploadPicture src={thumbnail} alt="" sizes="48px" className="h-12 w-12 shrink-0 rounded-nested object-cover" />;
  }
  const { from, to, light } = gradientFromString(title);
  const initials = title
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
 * The whole card is the outbound link — there is no detail page, so a click
 * goes straight to the resource with no interstitial or redirect hop.
 *
 * `rel="noopener noreferrer"` is not optional here: `target="_blank"` without
 * `noopener` hands the destination a live `window.opener` handle it can use to
 * navigate this tab elsewhere (reverse tabnabbing).
 *
 * The visible hostname under the title is the honest version of "where does
 * this go": it is read from the stored URL, and the platform badge beside it
 * was derived from that same hostname server-side, so neither can be talked
 * into naming a site the link does not actually open.
 */
export function FreeResourceCard({ resource }: { resource: FreeResourceCardDTO }) {
  const host = hostnameOf(resource.url);
  const sourceLabel = labelFor(RESOURCE_SOURCE_LABELS, resource.sourceType);

  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cardClasses("gap-3 p-4")}
    >
      <div className="flex items-start gap-3">
        <ResourceThumb title={resource.title} thumbnail={resource.thumbnail} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 font-semibold text-card-foreground group-hover:text-primary">
            {resource.title}
          </h3>
          {host && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
              {host}
            </p>
          )}
        </div>
      </div>

      {resource.description && (
        <p className="line-clamp-2 text-sm text-muted-foreground">{resource.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {resource.featured && (
          <Badge variant="warning">
            <Sparkles className="h-3 w-3" aria-hidden />
            Featured
          </Badge>
        )}
        <Badge variant="secondary">{sourceLabel}</Badge>
        <Badge variant="outline">{labelFor(RESOURCE_CATEGORY_LABELS, resource.category)}</Badge>
      </div>

      {resource.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {resource.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs font-medium text-primary">
        <span>Open resource</span>
        {/* Tells the user this leaves the site, for anyone who can't see the icon. */}
        <span className="inline-flex items-center gap-1">
          <span className="sr-only">(opens {sourceLabel} in a new tab, leaving Courses Monster)</span>
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
        </span>
      </div>
    </a>
  );
}
