"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminParams, useDebouncedParam } from "@/components/admin/use-admin-params";

const ALL = "__all__";

export function PaymentFilters({ statuses }: { statuses: string[] }) {
  const { searchParams, update } = useAdminParams();
  const [q, setQ] = useDebouncedParam("q", update, searchParams);
  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative w-72">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Email, order, invoice or payment id…" className="pl-9" />
      </div>
      <div className="w-48">
        <Select value={searchParams.get("status") || ALL} onValueChange={(v) => update({ status: v === ALL ? "" : v })}>
          <SelectTrigger aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="w-40">
        <Select value={searchParams.get("plan") || ALL} onValueChange={(v) => update({ plan: v === ALL ? "" : v })}>
          <SelectTrigger aria-label="Filter by plan"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All plans</SelectItem>
            <SelectItem value="MONTHLY">Monthly</SelectItem>
            <SelectItem value="YEARLY">Yearly</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
