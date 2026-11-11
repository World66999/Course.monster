import Link from "next/link";
import { ArrowUpRight, BookOpen, Crown, Download, Eye, Gift, IndianRupee, Users, Wallet } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth-helpers";
import { adminPath } from "@/lib/admin-path";
import { RANGE_OPTIONS, getRevenueSeries, getTrafficSeries, parseRange, total } from "@/lib/admin-stats";
import { formatInr } from "@/lib/premium-plans";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { TimeChart } from "@/components/admin/time-chart";

export const dynamic = "force-dynamic";

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;

function Panel({
  title,
  hint,
  action,
  className,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("min-w-0 rounded-card border border-border bg-card p-4 shadow-soft sm:p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requireAdmin();
  // Revenue and payments are for administrators only (same rule as the payment pages).
  const isAdmin = viewer.role === "ADMIN";
  const raw = await searchParams;
  const range = parseRange(typeof raw.range === "string" ? raw.range : undefined);
  const now = new Date();

  const [traffic, revenue, courseCount, publishedCount, activeMembers, popularCourses, recentEvents, recentAudit] =
    await Promise.all([
      getTrafficSeries(range),
      isAdmin ? getRevenueSeries(range) : null,
      db.course.count(),
      db.course.count({ where: { published: true } }),
      db.user.count({ where: { premiumUntil: { gt: now } } }),
      db.course.findMany({
        orderBy: { downloads: "desc" },
        take: 5,
        select: { id: true, title: true, downloads: true, views: true, published: true },
      }),
      db.downloadEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { course: { select: { title: true } } },
      }),
      db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { user: { select: { name: true } } },
      }),
    ]);

  const last = traffic.days.length - 1;
  const unlocksPerDay = traffic.days.map(
    (_, i) => traffic.unlocks.vplink[i]! + traffic.unlocks.gplinks[i]! + traffic.unlocks.linkshortify[i]!
  );

  const tiles = [
    {
      label: "Visitors today",
      value: formatNumber(traffic.visitors[last] ?? 0),
      sub: `${formatNumber(traffic.visitors[last - 1] ?? 0)} yesterday · ${formatNumber(total(traffic.visitors))} in ${range} days`,
      icon: Users,
    },
    {
      label: "Downloads today",
      value: formatNumber(traffic.downloads[last] ?? 0),
      sub: `${formatNumber(total(traffic.downloads))} in ${range} days`,
      icon: Download,
    },
    {
      label: "Free unlocks today",
      value: formatNumber(unlocksPerDay[last] ?? 0),
      sub: `${formatNumber(total(unlocksPerDay))} in ${range} days`,
      icon: Gift,
    },
    ...(revenue
      ? [
          {
            label: `Premium sales · ${range} days`,
            value: formatNumber(revenue.totals.sales),
            sub: `${formatNumber(activeMembers)} active members now`,
            icon: Crown,
          },
          {
            label: `Revenue · ${range} days`,
            value: usd(revenue.totals.usd),
            sub: `Razorpay ${formatInr(revenue.totals.razorpayPaise)} · crypto ${usd(revenue.totals.nowpaymentsUsd)}`,
            icon: Wallet,
          },
        ]
      : [
          {
            label: "Active members",
            value: formatNumber(activeMembers),
            sub: "Premium right now",
            icon: Crown,
          },
        ]),
    {
      label: "Courses",
      value: formatNumber(courseCount),
      sub: `${publishedCount} published`,
      icon: BookOpen,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-heading">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Days are India time (IST), the same day the free-unlock limit uses.</p>
        </div>
        {/* One row of filters above the charts. */}
        <nav aria-label="Time range" className="inline-flex rounded-full border border-border bg-card p-1 shadow-soft">
          {RANGE_OPTIONS.map((r) => (
            // A plain link (full page load) on purpose. With Next's client-side
            // navigation, a move to this same page with only the query changed
            // was silently dropped about half the time in testing (the data was
            // fetched, then never applied). A range switch must always work.
            <a
              key={r}
              href={r === 30 ? adminPath("") : `${adminPath("")}?range=${r}`}
              aria-current={r === range ? "true" : undefined}
              className={cn(
                "inline-flex h-9 pointer-coarse:h-11 min-w-14 items-center justify-center rounded-full px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                r === range ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r} days
            </a>
          ))}
        </nav>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        {tiles.map(({ label, value, sub, icon: Icon }) => (
          <div key={label} className="min-w-0 rounded-card border border-border bg-card p-4 shadow-soft">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
              <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            </div>
            <p className="numeric mt-1.5 truncate text-2xl font-bold tracking-tight sm:text-3xl">{value}</p>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
        <Panel
          title="Visitors"
          hint="Unique visitors and page views on the public site. Counting started when this dashboard was released."
          className="xl:col-span-2"
        >
          <TimeChart
            title={`Visitors and page views per day, last ${range} days`}
            labels={traffic.days}
            type="lines"
            series={[
              { key: "visitors", label: "Visitors", slot: 1, values: traffic.visitors },
              { key: "views", label: "Page views", slot: 2, values: traffic.pageViews },
            ]}
          />
        </Panel>

        <Panel title="Popular courses" hint="All time, by downloads">
          <ol className="space-y-1">
            {popularCourses.map((course, i) => (
              <li key={course.id}>
                <Link prefetch={false}
                  href={adminPath(`courses/${course.id}/edit`)}
                  className="group flex min-h-11 items-center gap-3 rounded-nested p-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="numeric flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium group-hover:text-primary">{course.title}</p>
                    <p className="numeric text-xs text-muted-foreground">
                      {formatNumber(course.downloads)} downloads · {formatNumber(course.views)} views
                    </p>
                  </div>
                  {!course.published && <Badge variant="secondary">Draft</Badge>}
                </Link>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
        <Panel title="Free unlocks by shortener" hint="Completed free unlocks per day">
          <TimeChart
            title={`Free unlocks per day by shortener, last ${range} days`}
            labels={traffic.days}
            type="bars"
            series={[
              { key: "vplink", label: "VPLink", slot: 1, values: traffic.unlocks.vplink },
              { key: "gplinks", label: "GPLinks", slot: 2, values: traffic.unlocks.gplinks },
              { key: "linkshortify", label: "LinkShortify", slot: 3, values: traffic.unlocks.linkshortify },
            ]}
          />
        </Panel>
        <Panel title="Downloads" hint="Every completed download, free and Premium">
          <TimeChart
            title={`Downloads per day, last ${range} days`}
            labels={traffic.days}
            type="bars"
            series={[{ key: "downloads", label: "Downloads", slot: 1, values: traffic.downloads }]}
          />
        </Panel>
      </div>

      {revenue ? (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
          <Panel
            title="Premium sales"
            hint="Paid plans per day, by payment gateway"
            action={
              <Link prefetch={false} href={adminPath("payments")} className="inline-flex min-h-9 shrink-0 items-center gap-0.5 text-xs font-medium text-primary hover:underline">
                All payments
                <ArrowUpRight className="h-3 w-3" aria-hidden />
              </Link>
            }
          >
            <TimeChart
              title={`Premium sales per day by gateway, last ${range} days`}
              labels={revenue.days}
              type="bars"
              series={[
                { key: "razorpay", label: "Razorpay (UPI/card)", slot: 1, values: revenue.sales.razorpay },
                { key: "nowpayments", label: "NOWPayments (crypto)", slot: 2, values: revenue.sales.nowpayments },
              ]}
            />
          </Panel>
          <Panel title="Revenue by gateway" hint="US dollars at each plan's price. Settled payments only.">
            <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-nested bg-muted/60 p-3">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <IndianRupee className="h-3.5 w-3.5" aria-hidden /> Razorpay
                </dt>
                <dd className="numeric mt-0.5 font-bold">
                  {usd(revenue.totals.razorpayUsd)}{" "}
                  <span className="font-normal text-muted-foreground">({formatInr(revenue.totals.razorpayPaise)})</span>
                </dd>
              </div>
              <div className="rounded-nested bg-muted/60 p-3">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" aria-hidden /> NOWPayments
                </dt>
                <dd className="numeric mt-0.5 font-bold">{usd(revenue.totals.nowpaymentsUsd)}</dd>
              </div>
            </dl>
            <TimeChart
              title={`Revenue per day by gateway in US dollars, last ${range} days`}
              labels={revenue.days}
              type="bars"
              format="usd"
              series={[
                { key: "razorpay", label: "Razorpay (UPI/card)", slot: 1, values: revenue.usd.razorpay },
                { key: "nowpayments", label: "NOWPayments (crypto)", slot: 2, values: revenue.usd.nowpayments },
              ]}
            />
          </Panel>
        </div>
      ) : (
        <p className="rounded-card border border-dashed border-border p-4 text-sm text-muted-foreground">
          Sales and revenue charts are visible to administrators only.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
        <Panel title="Recent downloads">
          {recentEvents.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No downloads yet.</p>
          ) : (
            <ul className="space-y-1">
              {recentEvents.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-3 rounded-nested px-2 py-1.5 text-sm">
                  <span className="inline-flex min-w-0 items-center gap-2">
                    {event.source === "telegram" ? (
                      <Badge variant="info" className="shrink-0">Bot</Badge>
                    ) : (
                      <Eye className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                    )}
                    <span className="truncate">{event.course.title}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground" suppressHydrationWarning>
                    {formatDistanceToNow(event.createdAt, { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Recent activity"
          action={
            <Link prefetch={false} href={adminPath("activity")} className="inline-flex min-h-9 shrink-0 items-center gap-0.5 text-xs font-medium text-primary hover:underline">
              View all
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            </Link>
          }
        >
          {recentAudit.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-1">
              {recentAudit.map((log) => (
                <li key={log.id} className="flex items-center justify-between gap-3 rounded-nested px-2 py-1.5 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{log.user?.name ?? "System"}</span>{" "}
                    <span className="text-muted-foreground">{log.action}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground" title={formatDate(log.createdAt)} suppressHydrationWarning>
                    {formatDistanceToNow(log.createdAt, { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
