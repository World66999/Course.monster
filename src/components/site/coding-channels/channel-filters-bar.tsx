"use client";

import * as React from "react";
import { X } from "lucide-react";
import { useDebouncedSearchParam, useFilterParams } from "@/components/site/use-filter-params";
import { FilterSearchIcon } from "@/components/site/filter-search-icon";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterPill, FilterPillGhost } from "@/components/ui/filter-pill";

const ALL = "__all__";
const PILL_VISIBLE = 12;

const LEVEL_OPTIONS = [
  { value: ALL, label: "All levels" },
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
  { value: "ALL_LEVELS", label: "All Levels" },
] as const;

const SORT_OPTIONS = [
  { value: "newest", label: "Recently Added" },
  { value: "popular", label: "Most Popular" },
  { value: "az", label: "A–Z" },
] as const;

export function ChannelFiltersBar({ tags }: { tags: string[] }) {
  const { searchParams, update, replaceLive, isPending } = useFilterParams();

  const currentTag = searchParams.get("tag") ?? "";
  const currentLevel = searchParams.get("level") ?? "";
  const currentSort = searchParams.get("sort") ?? "newest";
  const currentFlag = searchParams.get("flag") ?? "";

  const [search, setSearch, searchPending] = useDebouncedSearchParam("q", replaceLive, searchParams);

  const [tagsExpanded, setTagsExpanded] = React.useState(false);
  const visibleTags = tagsExpanded ? tags : tags.slice(0, PILL_VISIBLE);
  const hiddenCount = tags.length - visibleTags.length;

  return (
    <div className="space-y-4" aria-busy={isPending}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <FilterSearchIcon pending={isPending || searchPending} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search channels…"
            aria-label="Search coding channels"
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
            <SelectTrigger aria-label="Sort channels">
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
            <SelectTrigger aria-label="Filter by badge">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All channels</SelectItem>
              <SelectItem value="featured">Featured</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by topic">
          <FilterPill active={!currentTag} onClick={() => update({ tag: "" })}>
  All
</FilterPill>
          {visibleTags.map((tag) => (
            <FilterPill key={tag} active={currentTag === tag} onClick={() => update({ tag: currentTag === tag ? "" : tag })}>
  #{tag}
</FilterPill>
          ))}
          {hiddenCount > 0 && (
            <FilterPillGhost onClick={() => setTagsExpanded(true)}>
  +{hiddenCount} more
</FilterPillGhost>
          )}
        </div>
      )}
    </div>
  );
}
