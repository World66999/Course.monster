import type { Metadata } from "next";
import Link from "next/link";
import { Prisma, type SubscriptionStatus } from "@prisma/client";
import { Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth-helpers";
import { adminPath } from "@/lib/admin-path";
import { PLANS, formatInr, isPlanKey } from "@/lib/premium-plans";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Payments & subscriptions" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

/**
 * One list across both gateways, plus the subscription periods they created.
 *
 * Read-only, like the per-gateway pages it links to: there is deliberately no
 * refund, edit or re-run action here. Each gateway keeps its own status
 * vocabulary in the database; this page groups them into the four states an
 * admin actually filters by.
 */
const STATE_GROUPS = {
  paid: { label: "Paid", np: ["FINISHED"], rzp: ["PAID"] },
  pending: {
    label: "Pending",
    np: ["PENDING", "WAITING", "CONFIRMING", "CONFIRMED", "SENDING", "PARTIALLY_PAID"],
    rzp: ["PENDING"],
  },
  failed: { label: "Failed / expired", np: ["FAILED", "EXPIRED", "REFUNDED"], rzp: ["FAILED", "EXPIRED", "CANCELLED"] },
  review: { label: "Needs review", np: [] as string[], rzp: ["FLAGGED"] },
} as const;
type StateKey = keyof typeof STATE_GROUPS;

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "secondary" | "info"> = {
  FINISHED: "success",
  PAID: "success",
  PARTIALLY_PAID: "warning",
  FLAGGED: "warning",
  FAILED: "destructive",
  REFUNDED: "destructive",
  CANCELLED: "secondary",
  EXPIRED: "secondary",
  WAITING: "info",
  CONFIRMING: "info",
  CONFIRMED: "info",
  SENDING: "info",
  PENDING: "info",
};

const SUB_STATUSES: SubscriptionStatus[] = ["ACTIVE", "EXPIRED", "REVOKED", "REFUNDED"];
const SUB_VARIANT: Record<SubscriptionStatus, "success" | "secondary" | "destructive" | "warning"> = {
  ACTIVE: "success",
  EXPIRED: "secondary",
  REVOKED: "destructive",
  REFUNDED: "destructive",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const stamp = (d: Date | null) => (d ? d.toISOString().slice(0, 16).replace("T", " ") : "—");

interface PaymentRow {
  gateway: "razorpay" | "nowpayments";
  id: string;
  createdAt: Date;
  fulfilledAt: Date | null;
  plan: string;
  usd: number;
  paise: number | null;
  coin: string | null;
  status: string;
  ref: string;
  userId: string;
  email: string | null;
}

function Pill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    // A plain link (full page load), not a client-side navigation: see the
    // note on the dashboard's range switch. Filters must never be a no-op.
    <a
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-10 pointer-coarse:h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
      )}
    >
      {children}
    </a>
  );
}

export default async function AdminAllPaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireAdmin();
  if (viewer.role !== "ADMIN") {
    return <p className="text-muted-foreground">Payments are visible to administrators only.</p>;
  }

  const raw = await searchParams;
  const tab = first(raw.tab) === "subscriptions" ? "subscriptions" : "payments";
  const gateway = ["razorpay", "nowpayments"].includes(first(raw.gateway)) ? first(raw.gateway) : "";
  const state = (first(raw.state) in STATE_GROUPS ? first(raw.state) : "") as StateKey | "";
  const subStatus = SUB_STATUSES.includes(first(raw.status) as SubscriptionStatus) ? (first(raw.status) as SubscriptionStatus) : "";
  const q = first(raw.q).trim().slice(0, 100);
  const page = Math.max(1, Number(first(raw.page)) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const base = adminPath("payments");
  const link = (patch: Record<string, string>) => {
    const next: Record<string, string> = { tab, gateway, state, status: subStatus, q, ...patch };
    const s = new URLSearchParams();
    if (next.tab === "subscriptions") s.set("tab", "subscriptions");
    if (next.tab !== "subscriptions" && next.gateway) s.set("gateway", next.gateway);
    if (next.tab !== "subscriptions" && next.state) s.set("state", next.state);
    if (next.tab === "subscriptions" && next.status) s.set("status", next.status);
    if (next.q) s.set("q", next.q);
    if (next.page && next.page !== "1") s.set("page", next.page);
    const qs = s.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;

  let rows: PaymentRow[] = [];
  let totalRows = 0;
  let subs: Awaited<ReturnType<typeof loadSubs>>["rows"] = [];

  async function loadSubs() {
    const where: Prisma.SubscriptionWhereInput = {
      ...(subStatus ? { status: subStatus } : {}),
      ...(q ? { user: { email: { contains: q, mode: "insensitive" } } } : {}),
    };
    const [count, list] = await Promise.all([
      db.subscription.count({ where }),
      db.subscription.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: PAGE_SIZE,
        select: {
          id: true,
          plan: true,
          status: true,
          source: true,
          startAt: true,
          expiresAt: true,
          paymentId: true,
          razorpayPaymentId: true,
          note: true,
          user: { select: { id: true, email: true } },
        },
      }),
    ]);
    return { count, rows: list };
  }

  if (tab === "subscriptions") {
    const result = await loadSubs();
    subs = result.rows;
    totalRows = result.count;
  } else {
    const npStates = state ? STATE_GROUPS[state].np : null;
    const rzpStates = state ? STATE_GROUPS[state].rzp : null;
    const includeNp = gateway !== "razorpay" && (!npStates || npStates.length > 0);
    const includeRzp = gateway !== "nowpayments" && (!rzpStates || rzpStates.length > 0);

    const npFilter = Prisma.sql`${npStates ? Prisma.sql`AND p.status::text IN (${Prisma.join([...npStates])})` : Prisma.empty}
      ${q ? Prisma.sql`AND (u.email ILIKE ${like} OR p."orderId" ILIKE ${like} OR p."invoiceId" ILIKE ${like} OR p."npPaymentId" ILIKE ${like})` : Prisma.empty}`;
    const rzpFilter = Prisma.sql`${rzpStates ? Prisma.sql`AND r.status::text IN (${Prisma.join([...rzpStates])})` : Prisma.empty}
      ${q ? Prisma.sql`AND (u.email ILIKE ${like} OR r."referenceId" ILIKE ${like} OR r."orderId" ILIKE ${like} OR r."paymentId" ILIKE ${like})` : Prisma.empty}`;

    const npSelect = Prisma.sql`
      SELECT 'nowpayments' AS gateway, p.id, p."createdAt", p."fulfilledAt", p.plan::text AS plan,
             p."priceAmount"::float8 AS usd, NULL::int AS paise, p."payCurrency" AS coin,
             p.status::text AS status, p."orderId" AS ref, u.id AS "userId", u.email
      FROM payments p JOIN users u ON u.id = p."userId" WHERE TRUE ${npFilter}`;
    const rzpSelect = Prisma.sql`
      SELECT 'razorpay' AS gateway, r.id, r."createdAt", r."fulfilledAt", r.plan::text AS plan,
             r."priceUsd"::float8 AS usd, r.amount AS paise, NULL::text AS coin,
             r.status::text AS status, r."referenceId" AS ref, u.id AS "userId", u.email
      FROM razorpay_payments r JOIN users u ON u.id = r."userId" WHERE TRUE ${rzpFilter}`;

    const parts = [includeNp ? npSelect : null, includeRzp ? rzpSelect : null].filter(Boolean) as Prisma.Sql[];
    if (parts.length > 0) {
      const union = Prisma.join(parts, " UNION ALL ");
      const [list, count] = await Promise.all([
        db.$queryRaw<PaymentRow[]>`SELECT * FROM (${union}) t ORDER BY t."createdAt" DESC LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
        db.$queryRaw<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM (${union}) t`,
      ]);
      rows = list;
      totalRows = count[0]?.n ?? 0;
    }
  }

  const pageCount = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading">Payments &amp; subscriptions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every payment from both gateways in one list. Times are UTC. For gateway detail, open{" "}
          <Link prefetch={false} href={adminPath("razorpay")} className="font-medium text-primary hover:underline">Razorpay</Link> or{" "}
          <Link prefetch={false} href={adminPath("premium")} className="font-medium text-primary hover:underline">NOWPayments</Link>.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="View">
        <Pill href={link({ tab: "payments", page: "1" })} active={tab === "payments"}>Payments</Pill>
        <Pill href={link({ tab: "subscriptions", page: "1" })} active={tab === "subscriptions"}>Subscriptions</Pill>
      </div>

      <div className="space-y-3 rounded-card border border-border bg-card p-4 shadow-soft">
        {/* GET form: search works without JavaScript and keeps the other filters. */}
        <form action={base} method="get" role="search" className="relative max-w-md">
          {tab === "subscriptions" && <input type="hidden" name="tab" value="subscriptions" />}
          {tab === "payments" && gateway && <input type="hidden" name="gateway" value={gateway} />}
          {tab === "payments" && state && <input type="hidden" name="state" value={state} />}
          {tab === "subscriptions" && subStatus && <input type="hidden" name="status" value={subStatus} />}
          <label htmlFor="pay-q" className="sr-only">Search</label>
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            id="pay-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder={tab === "payments" ? "Email, order or payment id" : "Member email"}
            className="h-11 w-full rounded-control border border-input bg-surface-sunken pr-3 pl-9 text-base focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none sm:text-sm"
          />
        </form>

        {tab === "payments" ? (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Gateway">
              <Pill href={link({ gateway: "", page: "1" })} active={!gateway}>All gateways</Pill>
              <Pill href={link({ gateway: "razorpay", page: "1" })} active={gateway === "razorpay"}>Razorpay</Pill>
              <Pill href={link({ gateway: "nowpayments", page: "1" })} active={gateway === "nowpayments"}>NOWPayments</Pill>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Status">
              <Pill href={link({ state: "", page: "1" })} active={!state}>Any status</Pill>
              {(Object.keys(STATE_GROUPS) as StateKey[]).map((k) => (
                <Pill key={k} href={link({ state: k, page: "1" })} active={state === k}>{STATE_GROUPS[k].label}</Pill>
              ))}
            </div>
          </>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Status">
            <Pill href={link({ status: "", page: "1" })} active={!subStatus}>Any status</Pill>
            {SUB_STATUSES.map((s) => (
              <Pill key={s} href={link({ status: s, page: "1" })} active={subStatus === s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </Pill>
            ))}
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {totalRows} {tab === "payments" ? "payment" : "subscription"}{totalRows === 1 ? "" : "s"}
      </p>

      <div className="overflow-x-auto rounded-card border border-border bg-card shadow-soft">
        {tab === "payments" ? (
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs tracking-wider text-muted-foreground uppercase">
                <th className="p-3 font-medium">Created</th>
                <th className="p-3 font-medium">Gateway</th>
                <th className="p-3 font-medium">Member</th>
                <th className="p-3 font-medium">Plan</th>
                <th className="p-3 font-medium">Amount</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Reference</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No payments match these filters.</td></tr>
              )}
              {rows.map((p) => (
                <tr key={`${p.gateway}-${p.id}`} className="border-b border-border last:border-0">
                  <td className="numeric p-3 whitespace-nowrap">{stamp(p.createdAt)}</td>
                  <td className="p-3 whitespace-nowrap">{p.gateway === "razorpay" ? "Razorpay" : "NOWPayments"}</td>
                  <td className="p-3">
                    <Link prefetch={false} href={adminPath(`users/${p.userId}`)} className="text-primary hover:underline">{p.email ?? "(no email)"}</Link>
                  </td>
                  <td className="p-3">{isPlanKey(p.plan) ? PLANS[p.plan].name : p.plan}</td>
                  <td className="numeric p-3 whitespace-nowrap">
                    {p.paise != null ? formatInr(p.paise) : `$${p.usd.toFixed(2)}`}
                    <span className="block text-xs text-muted-foreground">
                      {p.paise != null ? `$${p.usd.toFixed(2)}` : (p.coin ?? "").toUpperCase()}
                    </span>
                  </td>
                  <td className="p-3"><Badge variant={STATUS_VARIANT[p.status] ?? "secondary"}>{p.status}</Badge></td>
                  <td className="p-3 font-mono text-xs break-all text-muted-foreground">{p.ref}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs tracking-wider text-muted-foreground uppercase">
                <th className="p-3 font-medium">Member</th>
                <th className="p-3 font-medium">Plan</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Started</th>
                <th className="p-3 font-medium">Ends</th>
                <th className="p-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {subs.length === 0 && (
                <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">No subscriptions match these filters.</td></tr>
              )}
              {subs.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="p-3">
                    <Link prefetch={false} href={adminPath(`users/${s.user.id}`)} className="text-primary hover:underline">{s.user.email ?? "(no email)"}</Link>
                  </td>
                  <td className="p-3">{PLANS[s.plan].name}</td>
                  <td className="p-3"><Badge variant={SUB_VARIANT[s.status]}>{s.status}</Badge></td>
                  <td className="numeric p-3 whitespace-nowrap">{stamp(s.startAt)}</td>
                  <td className="numeric p-3 whitespace-nowrap">{stamp(s.expiresAt)}</td>
                  <td className="p-3 text-muted-foreground">
                    {s.razorpayPaymentId ? "Razorpay" : s.paymentId ? "NOWPayments" : s.source === "ADMIN" ? "Granted by admin" : "Payment"}
                    {s.note && <span className="block max-w-56 truncate text-xs">{s.note}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pageCount > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-center gap-4 text-sm">
          {page > 1 && <a href={link({ page: String(page - 1) })} className="inline-flex min-h-11 items-center font-medium text-primary">← Previous</a>}
          <span className="text-muted-foreground">Page {page} of {pageCount}</span>
          {page < pageCount && <a href={link({ page: String(page + 1) })} className="inline-flex min-h-11 items-center font-medium text-primary">Next →</a>}
        </nav>
      )}
    </div>
  );
}
