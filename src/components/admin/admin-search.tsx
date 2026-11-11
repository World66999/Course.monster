"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface AdminFilter {
  /** Search-param name. */
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

export function AdminSearch({
  placeholder,
  statusOptions,
  filters = [],
}: {
  placeholder: string;
  statusOptions?: { value: string; label: string }[];
  /** Extra dropdown filters; the first option of each is its "all" choice. */
  filters?: AdminFilter[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQ = searchParams.get("q") ?? "";
  const currentStatus = searchParams.get("status") ?? "";
  const [value, setValue] = React.useState(currentQ);
  const fallback = React.useRef<number | undefined>(undefined);

  const update = React.useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("page");
      for (const [k, v] of Object.entries(patch)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      const href = `${pathname}${params.size ? `?${params}` : ""}`;
      router.replace(href);
      // Safety net. The router occasionally drops a move to the same page with
      // only the query changed (see site/use-filter-params.ts): the address
      // never changes and the list stays unfiltered. If that happened, load
      // the address the plain way so a search or filter always applies.
      window.clearTimeout(fallback.current);
      fallback.current = window.setTimeout(() => {
        if (`${window.location.pathname}${window.location.search}` !== href) window.location.assign(href);
      }, 3000);
    },
    [router, pathname, searchParams]
  );
  React.useEffect(() => () => window.clearTimeout(fallback.current), []);

  React.useEffect(() => {
    if (value === currentQ) return;
    const t = setTimeout(() => update({ q: value.trim() }), 350);
    return () => clearTimeout(t);
  }, [value, currentQ, update]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <div className="relative min-w-0 flex-1 sm:min-w-64">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="pl-9"
        />
      </div>
      {statusOptions && (
        <div className="w-full sm:w-44">
          <Select
            value={currentStatus || "all"}
            onValueChange={(v) => update({ status: v === "all" ? "" : v })}
          >
            <SelectTrigger aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((o) => (
                <SelectItem key={o.value || "all"} value={o.value || "all"}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {filters.map((f) => (
        <div key={f.key} className="w-full sm:w-48">
          <Select
            value={searchParams.get(f.key) || "all"}
            onValueChange={(v) => update({ [f.key]: v === "all" ? "" : v })}
          >
            <SelectTrigger aria-label={f.label}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {f.options.map((o) => (
                <SelectItem key={o.value || "all"} value={o.value || "all"}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}
