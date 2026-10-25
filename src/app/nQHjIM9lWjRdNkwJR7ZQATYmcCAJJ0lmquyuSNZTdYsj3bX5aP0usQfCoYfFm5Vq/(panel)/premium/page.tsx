import type { Metadata } from "next";
import Link from "next/link";
import { Prisma, type PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth-helpers";
import { adminPath } from "@/lib/admin-path";
import { PLANS } from "@/lib/premium-plans";
import { Badge } from "@/components/ui/badge";
import { PaymentFilters } from "@/components/admin/premium/payment-filters";

export const metadata: Metadata = { title: "Payments & Premium" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;
const STATUSES: PaymentStatus[] = [
  "PENDING", "WAITING", "CONFIRMING", "CONFIRMED", "SENDING", "PARTIALLY_PAID", "FINISHED", "FAILED", "EXPIRED", "REFUNDED",
];
const VARIANT: Partial<Record<PaymentStatus, "success" | "warning" | "destructive" | "secondary" | "info">> = {
  FINISHED: "success",
  PARTIALLY_PAID: "warning",
  FAILED: "destructive",
  REFUNDED: "destructive",
  EXPIRED: "secondary",
  WAITING: "info",
  CONFIRMING: "info",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function revenueSince(since?: Date): Promise<string> {
  const agg = await db.payment.aggregate({
    _sum: { priceAmount: true },
    where: { status: "FINISHED", ...(since ? { fulfilledAt: { gte: since } } : {}) },
  });
  return (agg._sum.priceAmount ?? new Prisma.Decimal(0)).toFixed(2);
}

export default async function AdminPaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  // Revenue and payment records are ADMIN-only; an EDITOR sees a notice.
  const viewer = await requireAdmin();
  if (viewer.role !== "ADMIN") {
    return <p className="text-muted-foreground">Payments are visible to administrators only.</p>;
  }

  const raw = await searchParams;
  const status = first(raw.status) as PaymentStatus | "";
  const plan = first(raw.plan);
  const q = first(raw.q).slice(0, 100);
  const page = Math.max(1, Number(first(raw.page)) || 1);

  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const where: Prisma.PaymentWhereInput = {
    ...(STATUSES.includes(status as PaymentStatus) ? { status: status as PaymentStatus } : {}),
    ...(plan === "MONTHLY" || plan === "YEARLY" ? { plan } : {}),
    ...(q
      ? {
          OR: [
            { orderId: { contains: q } },
            { invoiceId: { contains: q } },
            { npPaymentId: { contains: q } },
            { user: { email: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [today, month, allTime, activeMembers, total, rows] = await Promise.all([
    revenueSince(startOfDay),
    revenueSince(startOfMonth),
    revenueSince(),
    db.user.count({ where: { premiumUntil: { gt: now } } }),
    db.payment.count({ where }),
    db.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        orderId: true,
        plan: true,
        priceAmount: true,
        payCurrency: true,
        status: true,
        actuallyPaid: true,
        createdAt: true,
        fulfilledAt: true,
        user: { select: { id: true, email: true } },
      },
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const qs = (p: number) => {
    const s = new URLSearchParams();
    if (status) s.set("status", status);
    if (plan) s.set("plan", plan);
    if (q) s.set("q", q);
    s.set("page", String(p));
    return `?${s.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading">Payments &amp; Premium</h1>
        <p className="mt-1 text-sm text-muted-foreground">Revenue counts finished (settled) NOWPayments invoices only, in USD. Days and months are UTC.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Today", value: `$${today}` },
          { label: "This month", value: `$${month}` },
          { label: "All time", value: `$${allTime}` },
          { label: "Active members", value: String(activeMembers) },
        ].map((c) => (
          <div key={c.label} className="rounded-card border border-border bg-card p-5 shadow-soft">
            <p className="text-xs tracking-wider text-muted-foreground uppercase">{c.label}</p>
            <p className="numeric mt-1 text-2xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      <PaymentFilters statuses={STATUSES} />

      <div className="overflow-x-auto rounded-card border border-border bg-card shadow-soft">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs tracking-wider text-muted-foreground uppercase">
              <th className="p-3 font-medium">Created</th>
              <th className="p-3 font-medium">User</th>
              <th className="p-3 font-medium">Plan</th>
              <th className="p-3 font-medium">Amount</th>
              <th className="p-3 font-medium">Coin</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Order</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No payments match.</td></tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="numeric p-3 whitespace-nowrap">{p.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                <td className="p-3">
                  <Link href={adminPath(`users/${p.user.id}`)} className="text-primary hover:underline">{p.user.email}</Link>
                </td>
                <td className="p-3">{PLANS[p.plan].name}</td>
                <td className="numeric p-3">${p.priceAmount.toFixed(2)}</td>
                <td className="p-3 uppercase">
                  {p.payCurrency}
                  {p.actuallyPaid && <span className="block text-xs text-muted-foreground normal-case">paid {p.actuallyPaid.toString()}</span>}
                </td>
                <td className="p-3"><Badge variant={VARIANT[p.status] ?? "secondary"}>{p.status}</Badge></td>
                <td className="p-3 font-mono text-xs text-muted-foreground">{p.orderId}</td>
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
