"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AI_CATEGORY_LABELS, AI_PRICING_LABELS } from "@/lib/directory-labels";

const ALL = "__all__";

const CATEGORY_OPTIONS = [
  { value: ALL, label: "All categories" },
  ...Object.entries(AI_CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
];
const PRICING_OPTIONS = [
  { value: ALL, label: "Any free option" },
  ...Object.entries(AI_PRICING_LABELS).map(([value, label]) => ({ value, label })),
];

const SORT_OPTIONS = [
  { value: "curated", label: "Recommended" },
  { value: "newest", label: "Newest" },
  { value: "az", label: "A–Z" },
] as const;

export function AiFiltersBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentQ = searchParams.get("q") ?? "";
  const currentCategory = searchParams.get("category") ?? "";
  const currentPricing = searchParams.get("pricing") ?? "";
  const currentSort = searchParams.get("sort") ?? "curated";

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
            placeholder="Search AI platforms…"
            aria-label="Search AI platforms"
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
            <SelectTrigger aria-label="Sort platforms">
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
            <SelectTrigger aria-label="Filter by category">
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
        <div className="sm:w-56">
          <Select value={currentPricing || ALL} onValueChange={(v) => update({ pricing: v === ALL ? "" : v })}>
            <SelectTrigger aria-label="Filter by how it is free">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRICING_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
