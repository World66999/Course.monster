"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CourseImage } from "@/components/site/course-image";
import { Badge } from "@/components/ui/badge";
import { hostnameOf } from "@/lib/external-resource";

interface CourseHit {
  slug: string;
  title: string;
  thumbnail: string | null;
  category: { name: string } | null;
}
interface ResourceHit {
  id: string;
  title: string;
  url: string;
  thumbnail: string | null;
}
interface PlatformHit {
  id: string;
  name: string;
  url: string;
  logo: string | null;
}

/**
 * A search result, normalized across the three sources so the list renders
 * one way. `href` is either an internal course route or an external URL —
 * `external` decides which, and is never inferred from the string.
 */
interface Hit {
  key: string;
  kind: "Course" | "Resource" | "AI Platform";
  title: string;
  subtitle: string | null;
  thumbnail: string | null;
  href: string;
  external: boolean;
}

/** Per-source cap. Kept small: this is a jump-to list, not the section pages. */
const PER_SOURCE = 4;

/** Fetch that resolves to null instead of throwing, so one slow/failed source can't blank the others. */
async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function SearchDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Hit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searched, setSearched] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  React.useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const q = encodeURIComponent(query.trim());

      /**
       * The three sources are queried in parallel, so the dialog costs one
       * round trip rather than three sequential ones. Each endpoint is
       * separately indexed, cached (s-maxage=60) and rate-limited, and each
       * failure is isolated by fetchJson — a rate-limited resources call
       * still leaves course results on screen.
       */
      const [courses, resources, platforms] = await Promise.all([
        fetchJson<{ items: CourseHit[] }>(`/api/courses?q=${q}&limit=${PER_SOURCE}`, controller.signal),
        fetchJson<{ items: ResourceHit[] }>(`/api/free-resources?q=${q}&limit=${PER_SOURCE}`, controller.signal),
        fetchJson<{ items: PlatformHit[] }>(`/api/ai-platforms?q=${q}&limit=${PER_SOURCE}`, controller.signal),
      ]);

      if (controller.signal.aborted) return;

      const hits: Hit[] = [
        ...(courses?.items ?? []).map((c) => ({
          key: `course:${c.slug}`,
          kind: "Course" as const,
          title: c.title,
          subtitle: c.category?.name ?? null,
          thumbnail: c.thumbnail,
          href: `/courses/${c.slug}`,
          external: false,
        })),
        ...(resources?.items ?? []).map((r) => ({
          key: `resource:${r.id}`,
          kind: "Resource" as const,
          title: r.title,
          subtitle: hostnameOf(r.url),
          thumbnail: r.thumbnail,
          href: r.url,
          external: true,
        })),
        ...(platforms?.items ?? []).map((p) => ({
          key: `platform:${p.id}`,
          kind: "AI Platform" as const,
          title: p.name,
          subtitle: hostnameOf(p.url),
          thumbnail: p.logo,
          href: p.url,
          external: true,
        })),
      ];

      setResults(hits);
      setSearched(true);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function goInternal(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  function renderInner(hit: Hit) {
    return (
      <>
        <div className="h-10 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
          <CourseImage src={hit.thumbnail} title={hit.title} className="[&>span]:text-xs" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{hit.title}</p>
          {hit.subtitle && (
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              {hit.external && <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />}
              {hit.subtitle}
            </p>
          )}
        </div>
        {/* The result type is always visible, so a Resource is never mistaken for a course page. */}
        <Badge variant="secondary" className="shrink-0">
          {hit.kind}
        </Badge>
      </>
    );
  }

  const rowClass =
    "flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Search"
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <Search className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Search…</span>
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] sm:inline">
            ⌘K
          </kbd>
        </button>
      </DialogTrigger>
      <DialogContent className="top-24 max-w-xl translate-y-0 p-0">
        <DialogTitle className="sr-only">Search Courses Monster</DialogTitle>
        <DialogDescription className="sr-only">
          Type to search published courses, free resources and AI platforms
        </DialogDescription>
        <div className="flex items-center gap-3 border-b border-border px-4">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
          )}
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Enter still means "see all course results" — unchanged.
              if (e.key === "Enter" && query.trim()) {
                setOpen(false);
                router.push(`/courses?q=${encodeURIComponent(query.trim())}`);
              }
            }}
            placeholder="Search courses, resources, AI tools…"
            aria-label="Search query"
            className="h-13 w-full rounded bg-transparent text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {results.map((hit) =>
            hit.external ? (
              <a
                key={hit.key}
                href={hit.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className={rowClass}
              >
                {renderInner(hit)}
              </a>
            ) : (
              <button key={hit.key} type="button" onClick={() => goInternal(hit.href)} className={rowClass}>
                {renderInner(hit)}
              </button>
            )
          )}
          {searched && !loading && results.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nothing found for “{query}”.
            </p>
          )}
          {!searched && !loading && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Start typing to search. Press Enter to see all course results.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
