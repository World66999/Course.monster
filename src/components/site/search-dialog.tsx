"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CourseImage } from "@/components/site/course-image";

interface SearchResult {
  slug: string;
  title: string;
  thumbnail: string | null;
  category: { name: string } | null;
}

export function SearchDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
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
      try {
        const res = await fetch(`/api/courses?q=${encodeURIComponent(query.trim())}&limit=6`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as { items: SearchResult[] };
          setResults(data.items);
          setSearched(true);
        }
      } catch {
        // aborted or offline — ignore
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function go(slug: string) {
    setOpen(false);
    setQuery("");
    router.push(`/courses/${slug}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Search courses"
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <Search className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Search courses…</span>
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] sm:inline">
            ⌘K
          </kbd>
        </button>
      </DialogTrigger>
      <DialogContent className="top-24 max-w-xl translate-y-0 p-0">
        <DialogTitle className="sr-only">Search courses</DialogTitle>
        <DialogDescription className="sr-only">
          Type to search all published courses
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
              if (e.key === "Enter" && query.trim()) {
                setOpen(false);
                router.push(`/courses?q=${encodeURIComponent(query.trim())}`);
              }
            }}
            placeholder="Search courses…"
            aria-label="Search query"
            className="h-13 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {results.map((r) => (
            <button
              key={r.slug}
              type="button"
              onClick={() => go(r.slug)}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted"
            >
              <div className="h-10 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                <CourseImage src={r.thumbnail} title={r.title} className="[&>span]:text-xs" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{r.title}</p>
                {r.category && (
                  <p className="text-xs text-muted-foreground">{r.category.name}</p>
                )}
              </div>
            </button>
          ))}
          {searched && !loading && results.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No courses found for “{query}”.
            </p>
          )}
          {!searched && !loading && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Start typing to search. Press Enter to see all results.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
