"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Search, ChevronLeft, ChevronRight, Loader2, EyeOff, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button, buttonClasses } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setUserDisabledAction } from "@/server/actions/admin-users";
import { safeAction } from "@/lib/safe-action";
import { cn } from "@/lib/utils";
import { useAdminParams, useDebouncedParam } from "@/components/admin/use-admin-params";

export interface AdminUserRow {
  id: string;
  name: string;
  username: string | null;
  email: string;
  role: "ADMIN" | "EDITOR" | "USER";
  emailVerified: boolean;
  disabled: boolean;
  hasPassword: boolean;
  hasGoogle: boolean;
  createdAt: string;
}

const ALL = "__all__";

export function UsersTable({
  rows,
  page,
  pageCount,
}: {
  rows: AdminUserRow[];
  page: number;
  pageCount: number;
}) {
  const router = useRouter();
  const { searchParams, update, goToPage, isPending } = useAdminParams();
  const [q, setQ] = useDebouncedParam("q", update, searchParams);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function toggleDisabled(row: AdminUserRow) {
    setBusyId(row.id);
    try {
      const result = await safeAction(() => setUserDisabledAction(row.id, !row.disabled));
      if (result.ok) {
        toast.success(row.disabled ? "Account restored" : "Account disabled");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setBusyId(null);
    }
  }

  const currentProvider = searchParams.get("provider") ?? "";
  const currentStatus = searchParams.get("status") ?? "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, username, email…"
            className="pl-9"
          />
        </div>
        <div className="w-44">
          <Select value={currentProvider || ALL} onValueChange={(v) => update({ provider: v === ALL ? "" : v })}>
            <SelectTrigger aria-label="Filter by provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All providers</SelectItem>
              <SelectItem value="google">Google</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="both">Google + Email</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-44">
          <Select value={currentStatus || ALL} onValueChange={(v) => update({ status: v === ALL ? "" : v })}>
            <SelectTrigger aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="unverified">Unverified</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Dimmed and inert while the next page/filter is being fetched, so a slow
          query does not leave stale rows looking current and clickable. */}
      <div
        aria-busy={isPending}
        className={cn(
          "relative overflow-x-auto rounded-card border border-border bg-card shadow-soft",
          "transition-opacity duration-200",
          isPending && "pointer-events-none opacity-60"
        )}
      >
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs tracking-wider text-muted-foreground uppercase">
              <th className="p-3 font-medium">User</th>
              <th className="p-3 font-medium">Role</th>
              <th className="p-3 font-medium">Provider</th>
              <th className="p-3 font-medium">Verified</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Joined</th>
              <th className="w-16 p-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-10 text-center text-muted-foreground">
                  No users match your filters.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border transition-colors duration-150 last:border-0 hover:bg-primary-soft/45">
                <td className="p-3">
                  <p className="font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">{row.username ? `@${row.username}` : row.email}</p>
                </td>
                <td className="p-3">
                  <Badge variant={row.role === "USER" ? "secondary" : "default"}>{row.role}</Badge>
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    {row.hasGoogle && <Badge variant="outline">Google</Badge>}
                    {row.hasPassword && <Badge variant="outline">Email</Badge>}
                  </div>
                </td>
                <td className="p-3">
                  <Badge variant={row.emailVerified ? "success" : "warning"}>
                    {row.emailVerified ? "Verified" : "Unverified"}
                  </Badge>
                </td>
                <td className="p-3">
                  <Badge variant={row.disabled ? "warning" : "success"}>
                    {row.disabled ? "Disabled" : "Active"}
                  </Badge>
                </td>
                <td className="p-3 whitespace-nowrap text-muted-foreground">
                  <span suppressHydrationWarning>{formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}</span>
                </td>
                <td className="p-3">
                  {row.role === "USER" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={row.disabled ? "Restore account" : "Disable account"}
                      disabled={busyId === row.id}
                      onClick={() => toggleDisabled(row)}
                    >
                      {busyId === row.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : row.disabled ? (
                        <RotateCcw className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
            className={buttonClasses("outline", "sm")}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => goToPage(page + 1)}
            className={buttonClasses("outline", "sm")}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
