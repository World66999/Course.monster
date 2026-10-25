"use client";

import * as React from "react";
import { X } from "lucide-react";
import { useDebouncedSearchParam, useFilterParams } from "@/components/site/use-filter-params";
import { FilterSearchIcon } from "@/components/site/filter-search-icon";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RESOURCE_CATEGORY_LABELS, RESOURCE_SOURCE_LABELS } from "@/lib/directory-labels";
import { cn } from "@/lib/utils";

const ALL = "__all__";

const CATEGORY_OPTIONS = [
  { value: ALL, label: "All types" },
  ...Object.entries(RESOURCE_CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
];
const SOURCE_OPTIONS = [
  { value: ALL, label: "All sources" },
  ...Object.entries(RESOURCE_SOURCE_LABELS).map(([value, label]) => ({ value, label })),
];

const SORT_OPTIONS = [
  { value: "curated", label: "Recommended" },
  { value: "newest", label: "Newest" },
  { value: "az", label: "A–Z" },
] as const;

export function ResourceFiltersBar({ tags }: { tags: string[] }) {
  const { searchParams, update, replaceLive, isPending } = useFilterParams();

  const currentCategory = searchParams.get("category") ?? "";
  const currentSource = searchParams.get("source") ?? "";
  const currentTag = searchParams.get("tag") ?? "";
  const currentSort = searchParams.get("sort") ?? "curated";

  const [search, setSearch, searchPending] = useDebouncedSearchParam("q", replaceLive, searchParams);

  return (
    <div className="space-y-4" aria-busy={isPending}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <FilterSearchIcon pending={isPending || searchPending} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search free resources…"
            aria-label="Search free resources"
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
          <Select value={currentSort} onValueChange={(v) => update({ sort: v === "curated" ? "" : v })}>
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

      <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
        <div className="sm:w-48">
          <Select value={currentCategory || ALL} onValueChange={(v) => update({ category: v === ALL ? "" : v })}>
            <SelectTrigger aria-label="Filter by resource type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:w-44">
          <Select value={currentSource || ALL} onValueChange={(v) => update({ source: v === ALL ? "" : v })}>
            <SelectTrigger aria-label="Filter by source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {tags.length > 0 && (
        /* `gap-2` on touch: the chips grow to 40px there, and 6px of gap between
           wrapped 40px rows is too tight to aim at reliably. */
        <div className="flex flex-wrap gap-1.5 pointer-coarse:gap-2">
          {tags.map((tag) => {
            const active = currentTag === tag;
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={active}
                onClick={() => update({ tag: active ? "" : tag })}
                className={cn(
                  // Tag chips: 26px as designed. Grown for real on touch rather
                  // than given `tap-target`, since they wrap into tight rows where
                  // invisible 44px boxes would overlap each other.
                  "cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors pointer-coarse:min-h-10 pointer-coarse:px-3.5",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                )}
              >
                #{tag}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
