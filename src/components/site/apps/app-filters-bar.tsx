"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORY_LABELS, PLATFORM_LABELS } from "@/components/site/apps/app-card";
import { cn } from "@/lib/utils";

const ALL = "__all__";

const CATEGORY_OPTIONS = [{ value: ALL, label: "All categories" }, ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))];
const PLATFORM_OPTIONS = [{ value: ALL, label: "All platforms" }, ...Object.entries(PLATFORM_LABELS).map(([value, label]) => ({ value, label }))];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most Popular" },
  { value: "az", label: "A–Z" },
] as const;

export function AppFiltersBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentQ = searchParams.get("q") ?? "";
  const currentCategory = searchParams.get("category") ?? "";
  const currentPlatform = searchParams.get("platform") ?? "";
  const currentSort = searchParams.get("sort") ?? "newest";
  const currentOpenSource = searchParams.get("openSource") === "true";

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
            placeholder="Search apps…"
            aria-label="Search apps"
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
            <SelectTrigger aria-label="Sort apps">
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
        <div className="sm:w-44">
          <Select value={currentPlatform || ALL} onValueChange={(v) => update({ platform: v === ALL ? "" : v })}>
            <SelectTrigger aria-label="Filter by platform">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLATFORM_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <button
          type="button"
          onClick={() => update({ openSource: currentOpenSource ? "" : "true" })}
          aria-pressed={currentOpenSource}
          className={cn(
            "col-span-2 cursor-pointer rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors sm:col-span-1",
            currentOpenSource
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:bg-muted"
          )}
        >
          Open Source only
        </button>
      </div>
    </div>
  );
}
