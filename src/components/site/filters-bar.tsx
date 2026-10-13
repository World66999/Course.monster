"use client";

import * as React from "react";
import { X } from "lucide-react";
import { useDebouncedSearchParam, useFilterParams } from "@/components/site/use-filter-params";
import { FilterSearchIcon } from "@/components/site/filter-search-icon";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FilterPill, FilterPillGhost } from "@/components/ui/filter-pill";

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
  const { searchParams, update, replaceLive, isPending } = useFilterParams();

  const currentCategory = searchParams.get("category") ?? "";
  const currentSort = searchParams.get("sort") ?? "newest";
  const currentTag = searchParams.get("tag") ?? "";
  const currentLevel = searchParams.get("level") ?? "";
  const currentLang = searchParams.get("lang") ?? "";
  const currentDuration = searchParams.get("duration") ?? "";
  const currentFlag = searchParams.get("flag") ?? "";

  const [search, setSearch, searchPending] = useDebouncedSearchParam("q", replaceLive, searchParams);

  const [categoriesExpanded, setCategoriesExpanded] = React.useState(false);
  React.useEffect(() => {
    const idx = categories.findIndex((c) => c.slug === currentCategory);
    if (idx >= PILL_VISIBLE) setCategoriesExpanded(true);
  }, [currentCategory, categories]);
  const visibleCategories = categoriesExpanded ? categories : categories.slice(0, PILL_VISIBLE);
  const hiddenCategoryCount = categories.length - visibleCategories.length;

  return (
    <div className="space-y-4" aria-busy={isPending}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <FilterSearchIcon pending={isPending || searchPending} />
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
            <FilterPill
              key={f.value}
              active={currentFlag === f.value}
              onClick={() => update({ flag: currentFlag === f.value ? "" : f.value })}
            >
              {f.label}
            </FilterPill>
          ))}
        </div>
      </div>

      {/* One swipeable row on phones — wrapped, the 10+ chips pushed the first
          result two screens down — and the familiar wrapped layout from sm up. */}
      <div
        className="-mx-4 flex snap-x scroll-px-4 items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 [&>*]:snap-start"
        role="group"
        aria-label="Filter by category"
      >
        <FilterPill active={!currentCategory} onClick={() => update({ category: "" })}>
          All
        </FilterPill>
        {visibleCategories.map((c) => (
          <FilterPill
            key={c.slug}
            active={currentCategory === c.slug}
            count={c.count}
            onClick={() => update({ category: currentCategory === c.slug ? "" : c.slug })}
          >
            {c.name}
          </FilterPill>
        ))}
        {hiddenCategoryCount > 0 && (
          <FilterPillGhost onClick={() => setCategoriesExpanded(true)}>
            +{hiddenCategoryCount} more
          </FilterPillGhost>
        )}
        {categoriesExpanded && categories.length > PILL_VISIBLE && (
          <FilterPillGhost onClick={() => setCategoriesExpanded(false)}>Show less</FilterPillGhost>
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
