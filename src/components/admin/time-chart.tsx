"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Daily time-series chart for the admin dashboard, drawn as plain SVG.
 *
 * `bars` stacks the series per day (use it when the parts add up to a total:
 * unlocks by provider, revenue by gateway). `lines` overlays them (visitors
 * vs page views). One y-axis, always from zero.
 *
 * Reading it never depends on colour or on hover alone: two or more series
 * always get a legend, pointer/touch/keyboard all drive the same readout,
 * and "View as table" has every number.
 *
 * Series colours are the `--chart-1..3` tokens in globals.css, a set checked
 * for colour-blind separation on both the light and dark card surface.
 */

export interface ChartSeries {
  key: string;
  label: string;
  /** 1-based slot into the --chart-N tokens. Fixed per entity, never by rank. */
  slot: 1 | 2 | 3;
  values: number[];
}

type Format = "number" | "usd";

const fmt = (n: number, format: Format) =>
  format === "usd"
    ? `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`
    : n.toLocaleString("en-US");

const compact = (n: number, format: Format) => {
  const body = n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k` : String(Math.round(n * 100) / 100);
  return format === "usd" ? `$${body}` : body;
};

/** A round number at or above `max`, so gridlines land on readable values. */
function niceMax(max: number): number {
  if (max <= 0) return 4;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  for (const m of [1, 2, 2.5, 4, 5, 10]) if (m * pow >= max) return Math.max(4, m * pow);
  return 10 * pow;
}

const H = 220;
const PAD = { top: 12, right: 12, bottom: 26, left: 40 };

export function TimeChart({
  title,
  labels,
  series,
  type,
  format = "number",
  className,
}: {
  /** Accessible name; the visible heading lives in the card around the chart. */
  title: string;
  /** One label per day, ISO `YYYY-MM-DD`. */
  labels: string[];
  series: ChartSeries[];
  type: "bars" | "lines";
  format?: Format;
  className?: string;
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(640);
  const [active, setActive] = React.useState<number | null>(null);

  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(260, Math.round(el.clientWidth)));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = labels.length;
  const innerW = width - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const totals = labels.map((_, i) => series.reduce((s, x) => s + (x.values[i] ?? 0), 0));
  const rawMax = type === "bars" ? Math.max(0, ...totals) : Math.max(0, ...series.flatMap((s) => s.values));
  const max = niceMax(rawMax);
  const step = n > 0 ? innerW / n : innerW;
  const xMid = (i: number) => PAD.left + step * i + step / 2;
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const everyX = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 64))));
  const dayLabel = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  };
  const isEmpty = rawMax === 0;

  const indexFromEvent = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || n === 0) return null;
    const i = Math.floor((clientX - rect.left - PAD.left) / step);
    return Math.min(n - 1, Math.max(0, i));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (n === 0) return;
    if (e.key === "ArrowRight") setActive((a) => Math.min(n - 1, (a ?? -1) + 1));
    else if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? n) - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(n - 1);
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  };

  const barW = Math.max(2, Math.min(22, step * 0.62));
  const tipLeft = active === null ? 0 : Math.min(Math.max(xMid(active), 96), width - 96);

  return (
    <div className={cn("min-w-0", className)}>
      {series.length > 1 && (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {series.map((s) => (
            <li key={s.key} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn("inline-block", type === "lines" ? "h-0.5 w-4 rounded-full" : "h-2.5 w-2.5 rounded-[3px]")}
                style={{ background: `var(--chart-${s.slot})` }}
              />
              {s.label}
            </li>
          ))}
        </ul>
      )}

      <div
        ref={wrapRef}
        className="relative touch-pan-y rounded-nested outline-none focus-visible:ring-2 focus-visible:ring-ring"
        tabIndex={0}
        role="group"
        aria-label={`${title}. Use the left and right arrow keys to read each day.`}
        onKeyDown={onKeyDown}
        onPointerMove={(e) => setActive(indexFromEvent(e.clientX))}
        onPointerDown={(e) => setActive(indexFromEvent(e.clientX))}
        onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
        onBlur={() => setActive(null)}
      >
        <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={title} className="block max-w-full">
          <g className="chart-grid">
            {ticks.map((t) => (
              <line key={t} x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
            ))}
          </g>
          <g className="chart-axis">
            {ticks.map((t) => (
              <text key={t} x={PAD.left - 8} y={y(t) + 3} textAnchor="end">
                {compact(t, format)}
              </text>
            ))}
            {labels.map((l, i) =>
              i % everyX === 0 ? (
                <text key={l} x={xMid(i)} y={H - 8} textAnchor="middle">
                  {dayLabel(l)}
                </text>
              ) : null
            )}
          </g>

          {active !== null && (
            <line x1={xMid(active)} x2={xMid(active)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--border-strong)" strokeWidth={1} strokeDasharray="3 3" />
          )}

          {type === "bars" &&
            labels.map((l, i) => {
              let acc = 0;
              const parts = series.filter((s) => (s.values[i] ?? 0) > 0);
              return (
                <g key={l} opacity={active === null || active === i ? 1 : 0.55}>
                  {parts.map((s, si) => {
                    const v = s.values[i] ?? 0;
                    const y1 = y(acc + v);
                    const h = Math.max(1, y(acc) - y1 - (si > 0 ? 2 : 0));
                    acc += v;
                    const top = si === parts.length - 1;
                    const r = top ? Math.min(4, barW / 2, h) : 0;
                    const x = xMid(i) - barW / 2;
                    // Rounded data end on the top segment only; square at the baseline.
                    const d = `M${x},${y1 + h} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + barW - r} Q${x + barW},${y1} ${x + barW},${y1 + r} V${y1 + h} Z`;
                    return <path key={s.key} d={d} fill={`var(--chart-${s.slot})`} />;
                  })}
                </g>
              );
            })}

          {type === "lines" &&
            series.map((s) => (
              <g key={s.key}>
                <polyline
                  fill="none"
                  stroke={`var(--chart-${s.slot})`}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={s.values.map((v, i) => `${xMid(i)},${y(v)}`).join(" ")}
                />
                {active !== null && (
                  <circle cx={xMid(active)} cy={y(s.values[active] ?? 0)} r={4.5} fill={`var(--chart-${s.slot})`} stroke="var(--card)" strokeWidth={2} />
                )}
              </g>
            ))}
        </svg>

        {isEmpty && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            No data in this period yet
          </p>
        )}

        {active !== null && !isEmpty && (
          <div
            role="status"
            className="pointer-events-none absolute top-1 z-10 w-44 -translate-x-1/2 rounded-control border border-border bg-surface-raised p-2.5 text-xs shadow-elevated"
            style={{ left: tipLeft }}
          >
            <p className="mb-1.5 font-semibold text-foreground">{dayLabel(labels[active]!)}</p>
            <ul className="space-y-1">
              {series.map((s) => (
                <li key={s.key} className="flex items-center justify-between gap-3">
                  <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
                    <span aria-hidden className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: `var(--chart-${s.slot})` }} />
                    <span className="truncate">{s.label}</span>
                  </span>
                  <span className="numeric font-semibold text-foreground">{fmt(s.values[active] ?? 0, format)}</span>
                </li>
              ))}
              {type === "bars" && series.length > 1 && (
                <li className="flex items-center justify-between gap-3 border-t border-border pt-1">
                  <span className="text-muted-foreground">Total</span>
                  <span className="numeric font-semibold text-foreground">{fmt(totals[active] ?? 0, format)}</span>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      <details className="mt-2 text-xs">
        <summary className="inline-flex min-h-9 cursor-pointer items-center rounded-control px-1 font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          View as table
        </summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-control border border-border">
          <table className="numeric w-full min-w-[20rem] text-left">
            <thead className="sticky top-0 bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5 font-medium">Day</th>
                {series.map((s) => (
                  <th key={s.key} className="px-3 py-1.5 text-right font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((l, i) => (
                <tr key={l} className="border-t border-border">
                  <td className="px-3 py-1.5">{dayLabel(l)}</td>
                  {series.map((s) => (
                    <td key={s.key} className="px-3 py-1.5 text-right">
                      {fmt(s.values[i] ?? 0, format)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
