"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CategoryOption {
  slug: string;
  name: string;
  count: number;
}

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "popular", label: "Most popular" },
  { value: "az", label: "A → Z" },
] as const;

export function FiltersBar({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentQ = searchParams.get("q") ?? "";
  const currentCategory = searchParams.get("category") ?? "";
  const currentSort = searchParams.get("sort") ?? "newest";
  const currentTag = searchParams.get("tag") ?? "";

  const [search, setSearch] = React.useState(currentQ);
  React.useEffect(() => setSearch(currentQ), [currentQ]);

  const update = React.useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      router.push(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  // Debounced search-as-you-type.
  React.useEffect(() => {
    if (search === currentQ) return;
    const t = setTimeout(() => update({ q: search.trim() }), 400);
    return () => clearTimeout(t);
  }, [search, currentQ, update]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses…"
            aria-label="Search courses"
            className="pl-9"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch("")}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="w-full sm:w-48">
          <Select value={currentSort} onValueChange={(v) => update({ sort: v === "newest" ? "" : v })}>
            <SelectTrigger aria-label="Sort courses">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
        <button
          type="button"
          onClick={() => update({ category: "" })}
          className={cn(
            "cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
            !currentCategory
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
          )}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => update({ category: currentCategory === c.slug ? "" : c.slug })}
            aria-pressed={currentCategory === c.slug}
            className={cn(
              "cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              currentCategory === c.slug
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            )}
          >
            {c.name}
            <span className="ml-1.5 text-xs opacity-70">{c.count}</span>
          </button>
        ))}
      </div>

      {currentTag && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Tag:</span>
          <Badge>
            #{currentTag}
            <button
              type="button"
              aria-label={`Remove tag filter ${currentTag}`}
              onClick={() => update({ tag: "" })}
              className="ml-1 cursor-pointer hover:opacity-70"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      )}
    </div>
  );
}
