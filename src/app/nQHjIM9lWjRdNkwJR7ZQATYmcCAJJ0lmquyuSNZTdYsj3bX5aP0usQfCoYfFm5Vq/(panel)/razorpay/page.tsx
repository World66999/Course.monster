import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma, RazorpayPaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth-helpers";
import { adminPath } from "@/lib/admin-path";
import { PLANS, formatInr } from "@/lib/premium-plans";
import { isRazorpayConfigured } from "@/lib/razorpay-config";
import { Badge } from "@/components/ui/badge";
import { RazorpayFilters } from "@/components/admin/premium/razorpay-filters";

export const metadata: Metadata = { title: "Razorpay Payments" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;
const STATUSES: RazorpayPaymentStatus[] = ["PENDING", "PAID", "FLAGGED", "FAILED", "EXPIRED", "CANCELLED"];
const VARIANT: Record<RazorpayPaymentStatus, "success" | "warning" | "destructive" | "secondary" | "info"> = {
  PAID: "success",
  FLAGGED: "destructive",
  PENDING: "info",
  FAILED: "warning",
  EXPIRED: "secondary",
  CANCELLED: "secondary",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function parseDay(raw: string, endOfDay: boolean): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return null;
  return endOfDay ? new Date(d.getTime() + 24 * 60 * 60 * 1000) : d;
}

async function paidSince(since?: Date): Promise<{ sum: number; count: number }> {
  const agg = await db.razorpayPayment.aggregate({
    _sum: { amount: true },
    _count: true,
    where: { status: "PAID", ...(since ? { fulfilledAt: { gte: since } } : {}) },
  });
  return { sum: agg._sum.amount ?? 0, count: agg._count };
}

const fmtTime = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ");

/**
 * Razorpay orders (website) and payment links (bot). Read-only: there is
 * deliberately no refund or edit action anywhere here. No secret is ever
 * rendered — only Razorpay ids, amounts and states.
 */
export default async function AdminRazorpayPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireAdmin();
  if (viewer.role !== "ADMIN") {
    return <p className="text-muted-foreground">Payments are visible to administrators only.</p>;
  }

  const raw = await searchParams;
  const status = first(raw.status);
  const plan = first(raw.plan);
  const channel = first(raw.channel);
  const q = first(raw.q).trim().slice(0, 100);
  const from = parseDay(first(raw.from), false);
  const to = parseDay(first(raw.to), true);
  const page = Math.max(1, Math.min(10_000, Number(first(raw.page)) || 1));

  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const where: Prisma.RazorpayPaymentWhereInput = {
    ...(STATUSES.includes(status as RazorpayPaymentStatus) ? { status: status as RazorpayPaymentStatus } : {}),
    ...(plan === "MONTHLY" || plan === "YEARLY" ? { plan } : {}),
    ...(channel === "WEB" || channel === "TELEGRAM" ? { channel } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
    ...(q
      ? {
          OR: [
            { orderId: { contains: q } },
            { paymentId: { contains: q } },
            { paymentLinkId: { contains: q } },
            { referenceId: { contains: q } },
            { telegramId: q },
            { user: { email: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [today, month, allTime, flaggedCount, pendingCount, filtered, total, rows, flagged] = await Promise.all([
    paidSince(startOfDay),
    paidSince(startOfMonth),
    paidSince(),
    db.razorpayPayment.count({ where: { status: "FLAGGED" } }),
    db.razorpayPayment.count({ where: { status: "PENDING" } }),
    db.razorpayPayment.aggregate({ _sum: { amount: true }, where: { ...where, status: "PAID" } }),
    db.razorpayPayment.count({ where }),
    db.razorpayPayment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        plan: true,
        channel: true,
        amount: true,
        status: true,
        flagReason: true,
        orderId: true,
        paymentId: true,
        paymentLinkId: true,
        telegramId: true,
        createdAt: true,
        fulfilledAt: true,
        user: { select: { id: true, email: true } },
      },
    }),
    db.razorpayPayment.findMany({
      where: { status: "FLAGGED" },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        id: true,
        plan: true,
        amount: true,
        flagReason: true,
        orderId: true,
        paymentLinkId: true,
        updatedAt: true,
        user: { select: { id: true, email: true } },
      },
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const qs = (p: number) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries({ status, plan, channel, q, from: first(raw.from), to: first(raw.to) })) if (v) s.set(k, v);
    s.set("page", String(p));
    return `?${s.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading">Razorpay Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          UPI / card / netbanking payments from the website and the Telegram bot. Revenue counts verified, captured
          payments only, in INR. Days and months are UTC. Crypto payments are under Payments &amp; Premium.
        </p>
        {!isRazorpayConfigured() && (
          <p className="mt-3 rounded-control border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
            Razorpay is not fully configured on this server — check the RAZORPAY_* and SUPPORT_TELEGRAM variables.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Today", value: formatInr(today.sum), sub: `${today.count} paid` },
          { label: "This month", value: formatInr(month.sum), sub: `${month.count} paid` },
          { label: "All time", value: formatInr(allTime.sum), sub: `${allTime.count} paid` },
          { label: "Open (pending)", value: String(pendingCount), sub: "orders & links" },
          { label: "Flagged", value: String(flaggedCount), sub: "need review", alert: flaggedCount > 0 },
        ].map((c) => (
          <div
            key={c.label}
            className={`rounded-card border bg-card p-5 shadow-soft ${c.alert ? "border-destructive/40" : "border-border"}`}
          >
            <p className="text-xs tracking-wider text-muted-foreground uppercase">{c.label}</p>
            <p className={`numeric mt-1 text-2xl font-bold ${c.alert ? "text-destructive" : ""}`}>{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.sub}</p>
          </div>
        ))}
      </div>

      {flagged.length > 0 && (
        <div className="rounded-card border border-destructive/30 bg-destructive/5 p-5">
          <h2 className="font-semibold text-destructive">Flagged for review</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Razorpay reported something that didn&apos;t match our order (amount, currency or link), so Premium was not
            activated. Check the payment in the Razorpay dashboard; if it is genuine, grant the time from the user&apos;s
            page.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {flagged.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="numeric text-muted-foreground">{fmtTime(f.updatedAt)}</span>
                <Link href={adminPath(`users/${f.user.id}`)} className="text-primary hover:underline">{f.user.email}</Link>
                <span>{PLANS[f.plan].name} · {formatInr(f.amount)}</span>
                <Badge variant="destructive">{f.flagReason ?? "flagged"}</Badge>
                <span className="font-mono text-xs text-muted-foreground">{f.orderId ?? f.paymentLinkId}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <RazorpayFilters statuses={STATUSES} />
      <p className="text-sm text-muted-foreground">
        {total} matching · paid in this view: <span className="numeric font-medium text-foreground">{formatInr(filtered._sum.amount ?? 0)}</span>
      </p>

      <div className="overflow-x-auto rounded-card border border-border bg-card shadow-soft">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs tracking-wider text-muted-foreground uppercase">
              <th className="p-3 font-medium">Created</th>
              <th className="p-3 font-medium">User</th>
              <th className="p-3 font-medium">Plan</th>
              <th className="p-3 font-medium">Amount</th>
              <th className="p-3 font-medium">Channel</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Razorpay ids</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No Razorpay payments match.</td></tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-border align-top last:border-0">
                <td className="numeric p-3 whitespace-nowrap">
                  {fmtTime(p.createdAt)}
                  {p.fulfilledAt && <span className="block text-xs text-muted-foreground">paid {fmtTime(p.fulfilledAt)}</span>}
                </td>
                <td className="p-3">
                  <Link href={adminPath(`users/${p.user.id}`)} className="text-primary hover:underline">{p.user.email}</Link>
                  {p.telegramId && <span className="block text-xs text-muted-foreground">tg {p.telegramId}</span>}
                </td>
                <td className="p-3">{PLANS[p.plan].name}</td>
                <td className="numeric p-3">{formatInr(p.amount)}</td>
                <td className="p-3">{p.channel === "TELEGRAM" ? "Bot" : "Website"}</td>
                <td className="p-3">
                  <Badge variant={VARIANT[p.status]}>{p.status}</Badge>
                  {p.flagReason && <span className="block text-xs text-destructive">{p.flagReason}</span>}
                </td>
                <td className="p-3 font-mono text-xs text-muted-foreground">
                  {p.orderId && <span className="block">{p.orderId}</span>}
                  {p.paymentLinkId && <span className="block">{p.paymentLinkId}</span>}
                  {p.paymentId && <span className="block text-foreground">{p.paymentId}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm">
          {page > 1 && <Link href={qs(page - 1)} className="text-primary">← Previous</Link>}
          <span className="text-muted-foreground">Page {page} of {pageCount}</span>
          {page < pageCount && <Link href={qs(page + 1)} className="text-primary">Next →</Link>}
        </div>
      )}
    </div>
  );
}
