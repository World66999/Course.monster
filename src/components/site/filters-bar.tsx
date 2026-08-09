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

const ALL = "__all__";
const PILL_VISIBLE = 10;

const LEVEL_OPTIONS = [
  { value: ALL, label: "All levels" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;

const DURATION_OPTIONS = [
  { value: ALL, label: "Any duration" },
  { value: "short", label: "Short (≤ 5h)" },
  { value: "medium", label: "Medium (5–20h)" },
  { value: "long", label: "Long (20h+)" },
] as const;

const FLAG_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "trending", label: "Trending" },
  { value: "popular", label: "Popular" },
] as const;

export function FiltersBar({
  categories,
  languages = [],
}: {
  categories: CategoryOption[];
  languages?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentQ = searchParams.get("q") ?? "";
  const currentCategory = searchParams.get("category") ?? "";
  const currentSort = searchParams.get("sort") ?? "newest";
  const currentTag = searchParams.get("tag") ?? "";
  const currentLevel = searchParams.get("level") ?? "";
  const currentLang = searchParams.get("lang") ?? "";
  const currentDuration = searchParams.get("duration") ?? "";
  const currentFlag = searchParams.get("flag") ?? "";

  const [search, setSearch] = React.useState(currentQ);
  React.useEffect(() => setSearch(currentQ), [currentQ]);

  const [categoriesExpanded, setCategoriesExpanded] = React.useState(false);
  React.useEffect(() => {
    const idx = categories.findIndex((c) => c.slug === currentCategory);
    if (idx >= PILL_VISIBLE) setCategoriesExpanded(true);
  }, [currentCategory, categories]);
  const visibleCategories = categoriesExpanded ? categories : categories.slice(0, PILL_VISIBLE);
  const hiddenCategoryCount = categories.length - visibleCategories.length;

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

      {/* Attribute filters */}
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
        <div className="sm:w-44">
          <Select
            value={currentLevel || ALL}
            onValueChange={(v) => update({ level: v === ALL ? "" : v })}
          >
            <SelectTrigger aria-label="Filter by skill level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEVEL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:w-44">
          <Select
            value={currentDuration || ALL}
            onValueChange={(v) => update({ duration: v === ALL ? "" : v })}
          >
            <SelectTrigger aria-label="Filter by duration">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {languages.length > 0 && (
          <div className="sm:w-44">
            <Select
              value={currentLang || ALL}
              onValueChange={(v) => update({ lang: v === ALL ? "" : v })}
            >
              <SelectTrigger aria-label="Filter by language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All languages</SelectItem>
                {languages.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {lang}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div
          className="col-span-2 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Show only"
        >
          {FLAG_OPTIONS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => update({ flag: currentFlag === f.value ? "" : f.value })}
              aria-pressed={currentFlag === f.value}
              className={cn(
                "cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all duration-200 active:scale-95",
                currentFlag === f.value
                  ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                  : "border-border bg-card text-muted-foreground shadow-soft hover:border-primary/50 hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
        <button
          type="button"
          onClick={() => update({ category: "" })}
          aria-pressed={!currentCategory}
          className={cn(
            "cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all duration-200 active:scale-95",
            !currentCategory
              ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/25"
              : "border-border bg-card text-muted-foreground shadow-soft hover:border-primary/50 hover:text-foreground"
          )}
        >
          All
        </button>
        {visibleCategories.map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => update({ category: currentCategory === c.slug ? "" : c.slug })}
            aria-pressed={currentCategory === c.slug}
            className={cn(
              "cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all duration-200 active:scale-95",
              currentCategory === c.slug
                ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                : "border-border bg-card text-muted-foreground shadow-soft hover:border-primary/50 hover:text-foreground"
            )}
          >
            {c.name}
            <span className="ml-1.5 text-xs tabular-nums">{c.count}</span>
          </button>
        ))}
        {hiddenCategoryCount > 0 && (
          <button
            type="button"
            onClick={() => setCategoriesExpanded(true)}
            className="cursor-pointer rounded-full border border-dashed border-border px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            +{hiddenCategoryCount} more
          </button>
        )}
        {categoriesExpanded && categories.length > PILL_VISIBLE && (
          <button
            type="button"
            onClick={() => setCategoriesExpanded(false)}
            className="cursor-pointer rounded-full border border-dashed border-border px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            Show less
          </button>
        )}
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
