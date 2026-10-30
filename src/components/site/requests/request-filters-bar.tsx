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
import { FilterPill, FilterPillGhost } from "@/components/ui/filter-pill";
import {
  REQUEST_STATUS_LABELS,
  REQUEST_SORT_LABELS,
  REQUEST_KIND_LABELS,
  type RequestStatus,
  type RequestSort,
  type RequestKind,
} from "@/lib/request-shared";

interface CategoryOption {
  slug: string;
  name: string;
}

const SORT_OPTIONS = (Object.keys(REQUEST_SORT_LABELS) as RequestSort[]).map((value) => ({
  value,
  label: REQUEST_SORT_LABELS[value],
}));

const ALL = "__all__";
const PILL_VISIBLE = 10;

const KIND_OPTIONS = [
  { value: ALL, label: "All" },
  ...(Object.keys(REQUEST_KIND_LABELS) as RequestKind[]).map((value) => ({
    value,
    label: REQUEST_KIND_LABELS[value],
  })),
];

const LEVEL_OPTIONS = [
  { value: ALL, label: "All levels" },
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
] as const;

const STATUS_OPTIONS = [
  { value: ALL, label: "All statuses" },
  ...(Object.keys(REQUEST_STATUS_LABELS) as RequestStatus[]).map((value) => ({
    value,
    label: REQUEST_STATUS_LABELS[value],
  })),
];

export function RequestFiltersBar({ categories }: { categories: CategoryOption[] }) {
  const { searchParams, update, replaceLive, isPending } = useFilterParams();

  const currentCategory = searchParams.get("category") ?? "";
  const currentSort = searchParams.get("sort") ?? "newest";
  const currentLevel = searchParams.get("level") ?? "";
  const currentStatus = searchParams.get("status") ?? "";
  const currentKind = searchParams.get("kind") ?? "";

  const [search, setSearch, searchPending] = useDebouncedSearchParam("q", replaceLive, searchParams);

  const [categoriesExpanded, setCategoriesExpanded] = React.useState(false);
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
            placeholder="Search requests…"
            aria-label="Search requests"
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
            <SelectTrigger aria-label="Sort requests">
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
          <Select value={currentKind || ALL} onValueChange={(v) => update({ kind: v === ALL ? "" : v })}>
            <SelectTrigger aria-label="Filter by type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:w-44">
          <Select value={currentLevel || ALL} onValueChange={(v) => update({ level: v === ALL ? "" : v })}>
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
          <Select value={currentStatus || ALL} onValueChange={(v) => update({ status: v === ALL ? "" : v })}>
            <SelectTrigger aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
          <FilterPill active={!currentCategory} onClick={() => update({ category: "" })}>
  All
</FilterPill>
          {visibleCategories.map((c) => (
            <FilterPill key={c.slug} active={currentCategory === c.slug} onClick={() => update({ category: currentCategory === c.slug ? "" : c.slug })}>
  {c.name}
</FilterPill>
          ))}
          {hiddenCategoryCount > 0 && (
            <FilterPillGhost onClick={() => setCategoriesExpanded(true)}>
  +{hiddenCategoryCount} more
</FilterPillGhost>
          )}
        </div>
      )}
    </div>
  );
}
