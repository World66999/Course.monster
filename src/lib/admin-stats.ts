import "server-only";
import { db } from "@/lib/db";
import { istDay } from "@/lib/shortener-core";

/**
 * Numbers for the admin dashboard charts.
 *
 * Read-only reporting. Every query is grouped by day in the database (at most
 * one row per day per series comes back), and "day" means the India (IST)
 * calendar day everywhere, the same day the free-unlock limit uses, so the
 * charts line up with what visitors experience.
 *
 * Revenue rules match the two payment pages exactly: a NOWPayments payment
 * counts when FINISHED, a Razorpay payment when PAID, both dated by
 * `fulfilledAt`. Razorpay revenue is shown in USD using the plan's dollar
 * price stored on the row (the fixed ₹100 = $1 rate is applied at checkout,
 * not here), with the rupee total alongside.
 */

/** Timestamps are stored as UTC; shift to IST before taking the date. */
const IST = "interval '330 minutes'";

export const RANGE_OPTIONS = [7, 30, 90] as const;
export type RangeDays = (typeof RANGE_OPTIONS)[number];

export function parseRange(value: string | undefined): RangeDays {
  const n = Number(value);
  return (RANGE_OPTIONS as readonly number[]).includes(n) ? (n as RangeDays) : 30;
}

/** The last `days` IST days, oldest first, ending today. */
function dayAxis(days: number, now = new Date()): string[] {
  return Array.from({ length: days }, (_, i) => istDay(new Date(now.getTime() - (days - 1 - i) * 86_400_000)));
}

const fill = (axis: string[], rows: Map<string, number>) => axis.map((d) => rows.get(d) ?? 0);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export interface DashboardSeries {
  days: string[];
  visitors: number[];
  pageViews: number[];
  downloads: number[];
  unlocks: { vplink: number[]; gplinks: number[]; linkshortify: number[] };
}

export async function getTrafficSeries(range: RangeDays): Promise<DashboardSeries> {
  const days = dayAxis(range);
  const startDay = days[0]!;
  // A day of slack on the UTC side; rows are re-bucketed by IST day below.
  const since = new Date(Date.now() - (range + 1) * 86_400_000);

  const [visits, downloads, unlocks] = await Promise.all([
    db.$queryRaw<{ day: string; visitors: number; views: number }[]>`
      SELECT day, COUNT(*)::int AS visitors, COALESCE(SUM(views), 0)::int AS views
      FROM site_visits WHERE day >= ${startDay} GROUP BY day`,
    db.$queryRawUnsafe<{ day: string; n: number }[]>(
      `SELECT to_char(("createdAt" + ${IST})::date, 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
       FROM download_events WHERE "createdAt" >= $1 GROUP BY 1`,
      since
    ),
    db.$queryRaw<{ day: string; provider: string; n: number }[]>`
      SELECT day, provider, COUNT(*)::int AS n
      FROM free_unlocks WHERE day >= ${startDay} GROUP BY day, provider`,
  ]);

  const byProvider = (p: string) =>
    fill(days, new Map(unlocks.filter((u) => u.provider === p).map((u) => [u.day, u.n])));

  return {
    days,
    visitors: fill(days, new Map(visits.map((v) => [v.day, v.visitors]))),
    pageViews: fill(days, new Map(visits.map((v) => [v.day, v.views]))),
    downloads: fill(days, new Map(downloads.map((d) => [d.day, d.n]))),
    unlocks: {
      vplink: byProvider("vplink"),
      gplinks: byProvider("gplinks"),
      linkshortify: byProvider("linkshortify"),
    },
  };
}

export interface RevenueSeries {
  days: string[];
  sales: { razorpay: number[]; nowpayments: number[] };
  usd: { razorpay: number[]; nowpayments: number[] };
  totals: {
    sales: number;
    usd: number;
    razorpayUsd: number;
    nowpaymentsUsd: number;
    /** Rupees actually charged through Razorpay in the period, in paise. */
    razorpayPaise: number;
  };
}

/** ADMIN-only data: callers must check the role before calling. */
export async function getRevenueSeries(range: RangeDays): Promise<RevenueSeries> {
  const days = dayAxis(range);
  const startDay = days[0]!;
  const since = new Date(Date.now() - (range + 1) * 86_400_000);

  const [np, rzp] = await Promise.all([
    db.$queryRawUnsafe<{ day: string; n: number; usd: number }[]>(
      `SELECT to_char(("fulfilledAt" + ${IST})::date, 'YYYY-MM-DD') AS day,
              COUNT(*)::int AS n, COALESCE(SUM("priceAmount"), 0)::float8 AS usd
       FROM payments WHERE status = 'FINISHED' AND "fulfilledAt" >= $1 GROUP BY 1`,
      since
    ),
    db.$queryRawUnsafe<{ day: string; n: number; usd: number; paise: number }[]>(
      `SELECT to_char(("fulfilledAt" + ${IST})::date, 'YYYY-MM-DD') AS day,
              COUNT(*)::int AS n, COALESCE(SUM("priceUsd"), 0)::float8 AS usd,
              COALESCE(SUM(amount), 0)::float8 AS paise
       FROM razorpay_payments WHERE status = 'PAID' AND "fulfilledAt" >= $1 GROUP BY 1`,
      since
    ),
  ]);

  const inRange = <T extends { day: string }>(rows: T[]) => rows.filter((r) => r.day >= startDay);
  const npRows = inRange(np);
  const rzpRows = inRange(rzp);
  const sales = {
    razorpay: fill(days, new Map(rzpRows.map((r) => [r.day, r.n]))),
    nowpayments: fill(days, new Map(npRows.map((r) => [r.day, r.n]))),
  };
  const usd = {
    razorpay: fill(days, new Map(rzpRows.map((r) => [r.day, r.usd]))),
    nowpayments: fill(days, new Map(npRows.map((r) => [r.day, r.usd]))),
  };
  return {
    days,
    sales,
    usd,
    totals: {
      sales: sum(sales.razorpay) + sum(sales.nowpayments),
      usd: sum(usd.razorpay) + sum(usd.nowpayments),
      razorpayUsd: sum(usd.razorpay),
      nowpaymentsUsd: sum(usd.nowpayments),
      razorpayPaise: sum(rzpRows.map((r) => r.paise)),
    },
  };
}

export const total = sum;
