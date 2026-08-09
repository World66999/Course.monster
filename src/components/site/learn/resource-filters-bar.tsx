"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface CategoryOption {
  slug: string;
  name: string;
}

const ALL = "__all__";
const PILL_VISIBLE = 10;

const LEVEL_OPTIONS = [
  { value: ALL, label: "All levels" },
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
  { value: "ALL_LEVELS", label: "All Levels" },
] as const;

const TYPE_OPTIONS = [
  { value: ALL, label: "Videos & Playlists" },
  { value: "VIDEO", label: "Videos only" },
  { value: "PLAYLIST", label: "Playlists only" },
] as const;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most Popular" },
] as const;

export function ResourceFiltersBar({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentQ = searchParams.get("q") ?? "";
  const currentCategory = searchParams.get("category") ?? "";
  const currentLevel = searchParams.get("level") ?? "";
  const currentType = searchParams.get("type") ?? "";
  const currentSort = searchParams.get("sort") ?? "newest";
  const currentFlag = searchParams.get("flag") ?? "";

  const [search, setSearch] = React.useState(currentQ);
  React.useEffect(() => setSearch(currentQ), [currentQ]);

  const [categoriesExpanded, setCategoriesExpanded] = React.useState(false);
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

  React.useEffect(() => {
    if (search === currentQ) return;
    const t = setTimeout(() => update({ q: search.trim() }), 400);
    return () => clearTimeout(t);
  }, [search, currentQ, update]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search free resources…"
            aria-label="Search learning resources"
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
            <SelectTrigger aria-label="Sort resources">
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

      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
        <div className="sm:w-44">
          <Select value={currentType || ALL} onValueChange={(v) => update({ type: v === ALL ? "" : v })}>
            <SelectTrigger aria-label="Filter by type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:w-44">
          <Select value={currentLevel || ALL} onValueChange={(v) => update({ level: v === ALL ? "" : v })}>
            <SelectTrigger aria-label="Filter by difficulty">
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
          <Select value={currentFlag || ALL} onValueChange={(v) => update({ flag: v === ALL ? "" : v })}>
            <SelectTrigger aria-label="Filter by featured">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All resources</SelectItem>
              <SelectItem value="featured">Featured</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {categories.length > 0 && (
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
        </div>
      )}
    </div>
  );
}
