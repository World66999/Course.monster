"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, Crown, Loader2, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { grantCourseAction, grantPremiumAction, revokeCourseGrantAction, revokePremiumAction } from "@/server/actions/admin-premium";
import { setUserDisabledAction } from "@/server/actions/admin-users";
import { safeAction } from "@/lib/safe-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminParams, useDebouncedParam } from "@/components/admin/use-admin-params";

interface Sub {
  id: string;
  plan: string;
  startAt: string;
  expiresAt: string;
  status: string;
  source: string;
  note: string | null;
}
interface CourseRow {
  id: string;
  title: string;
  premium: boolean;
  published?: boolean;
}

const D = (iso: string) => iso.slice(0, 10);

export function UserPremiumManager({
  user,
  subscriptions,
  grants,
  courses,
  courseQuery,
}: {
  user: { id: string; role: string; disabled: boolean; premiumUntil: string | null };
  subscriptions: Sub[];
  grants: CourseRow[];
  courses: CourseRow[];
  courseQuery: string;
}) {
  const router = useRouter();
  const { searchParams, update } = useAdminParams();
  const [cq, setCq] = useDebouncedParam("cq", update, searchParams);
  const [months, setMonths] = React.useState(1);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    setBusy(key);
    const res = await safeAction(fn, key);
    setBusy(null);
    if (res.ok) {
      toast.success(done);
      router.refresh();
    } else toast.error(res.error ?? "Failed");
  }

  const granted = new Set(grants.map((g) => g.id));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-card border border-border bg-card p-6 shadow-soft">
        <h2 className="flex items-center gap-2 font-semibold">
          <Crown className="h-4 w-4 text-gold-ink" aria-hidden /> Premium
        </h2>
        <p className="text-sm">
          {user.premiumUntil ? (
            <>Active until <strong>{D(user.premiumUntil)}</strong></>
          ) : (
            <span className="text-muted-foreground">Not Premium</span>
          )}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Months to add</span>
            <Input
              type="number"
              min={1}
              max={36}
              value={months}
              onChange={(e) => setMonths(Math.max(1, Math.min(36, Number(e.target.value) || 1)))}
              className="w-24"
            />
          </label>
          <label className="min-w-40 flex-1 text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Note (optional)</span>
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. paid by PayPal, ticket #…" />
          </label>
          <Button
            disabled={busy !== null}
            onClick={() => run("grant", () => grantPremiumAction({ userId: user.id, months, note }), user.premiumUntil ? "Premium extended" : "Premium granted")}
          >
            {busy === "grant" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {user.premiumUntil ? "Extend" : "Grant"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Time is added on top of the current expiry. Admins only.</p>
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {user.premiumUntil && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => confirm("Revoke Premium now?") && run("revoke", () => revokePremiumAction(user.id), "Premium revoked")}
            >
              <X className="h-4 w-4" /> Revoke Premium
            </Button>
          )}
          {user.role === "USER" && (
            <Button
              variant={user.disabled ? "outline" : "destructive"}
              size="sm"
              disabled={busy !== null}
              onClick={() => run("ban", () => setUserDisabledAction(user.id, !user.disabled), user.disabled ? "User unbanned" : "User banned")}
            >
              {user.disabled ? <RotateCcw className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
              {user.disabled ? "Unban" : "Ban user"}
            </Button>
          )}
        </div>

        <h3 className="pt-2 text-sm font-semibold">History</h3>
        {subscriptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No periods yet.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {subscriptions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2">
                <Badge variant={s.status === "ACTIVE" ? "success" : "secondary"}>{s.status}</Badge>
                <span className="numeric">{D(s.startAt)} → {D(s.expiresAt)}</span>
                <span className="text-muted-foreground">{s.plan} · {s.source === "ADMIN" ? "manual" : "paid"}</span>
                {s.note && <span className="text-xs text-muted-foreground">“{s.note}”</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4 rounded-card border border-border bg-card p-6 shadow-soft">
        <h2 className="font-semibold">Course access</h2>
        <p className="text-xs text-muted-foreground">Grant a specific course without a subscription.</p>
        {grants.length > 0 && (
          <ul className="space-y-1.5">
            {grants.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{c.title}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${c.title}`}
                  disabled={busy !== null}
                  onClick={() => run(`rg-${c.id}`, () => revokeCourseGrantAction({ userId: user.id, courseId: c.id }), "Course removed")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={cq} onChange={(e) => setCq(e.target.value)} placeholder="Search courses (default: premium courses)" className="pl-9" />
        </div>
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {courses.length === 0 && (
            <li className="text-sm text-muted-foreground">{courseQuery ? "No matching courses." : "No premium courses yet."}</li>
          )}
          {courses.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 rounded-control px-2 py-1.5 text-sm hover:bg-muted">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate">{c.title}</span>
                {c.premium && <Badge variant="premium">Premium</Badge>}
                {c.published === false && <Badge variant="secondary">Draft</Badge>}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={busy !== null || granted.has(c.id)}
                onClick={() => run(`g-${c.id}`, () => grantCourseAction({ userId: user.id, courseId: c.id }), "Course granted")}
              >
                {granted.has(c.id) ? "Granted" : "Grant"}
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
