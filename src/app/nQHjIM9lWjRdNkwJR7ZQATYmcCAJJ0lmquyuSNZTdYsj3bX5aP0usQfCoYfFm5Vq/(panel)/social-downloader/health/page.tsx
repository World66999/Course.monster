import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { serviceHealth } from "@/lib/social-download";

export const metadata: Metadata = { title: "Downloader health" };
export const dynamic = "force-dynamic";

/**
 * Service health.
 *
 * Every field rendered here is picked out by name. The raw response is never
 * spread into the page and the transport error is never printed, so an
 * unexpected payload or a failure message can't put an internal address,
 * a path or a credential on screen.
 */
interface Health {
  status?: unknown;
  ffmpeg?: unknown;
  tracked?: unknown;
  maxWorkers?: unknown;
  telegramWorkers?: unknown;
  freeBytes?: unknown;
  byStatus?: Record<string, unknown>;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export default async function SocialHealthPage() {
  const { up, detail } = await serviceHealth();
  const health: Health = up && detail && typeof detail === "object" ? (detail as Health) : {};

  const freeBytes = num(health.freeBytes);
  const freeGb = freeBytes === null ? null : freeBytes / (1024 * 1024 * 1024);
  const webWorkers = num(health.maxWorkers);
  const tgWorkers = num(health.telegramWorkers);
  const tracked = num(health.tracked);
  const byStatus = health.byStatus && typeof health.byStatus === "object" ? health.byStatus : {};

  const rows: Array<{ label: string; value: React.ReactNode; hint?: string }> = [
    {
      label: "Service",
      value: up ? <Badge variant="success">Reachable</Badge> : <Badge variant="warning">Unreachable</Badge>,
      hint: up
        ? "Responding on the internal loopback interface."
        : "The website cannot reach the downloader. Downloads will report as temporarily unavailable.",
    },
    {
      label: "FFmpeg",
      value: health.ffmpeg === true ? <Badge variant="success">Available</Badge> : <Badge variant="warning">Missing</Badge>,
      hint: "Required to merge separate video and audio streams.",
    },
    {
      label: "Website workers",
      value: webWorkers === null ? "—" : webWorkers,
      hint: "Concurrent website downloads allowed.",
    },
    {
      label: "Telegram workers",
      value: tgWorkers === null ? "—" : tgWorkers,
      hint: "A separate pool. Website traffic can never take one of these slots.",
    },
    {
      label: "Tracked jobs",
      value: tracked === null ? "—" : tracked,
      hint: "Jobs the service still holds, including finished ones inside their retention window.",
    },
    {
      label: "Free disk",
      value: freeGb === null ? "—" : `${freeGb.toFixed(1)} GB`,
      hint: "New jobs are refused below the configured floor rather than filling the disk.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-border/60 last:border-0">
                <td className="w-48 p-4 align-top font-medium">{r.label}</td>
                <td className="p-4 align-top">
                  <div className="tabular-nums">{r.value}</div>
                  {r.hint && <div className="mt-1 text-xs text-muted-foreground">{r.hint}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-semibold">Jobs currently held by the service</h2>
        {Object.keys(byStatus).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing in progress or retained.</p>
        ) : (
          <ul className="mt-3 space-y-1.5 text-sm">
            {Object.entries(byStatus).map(([status, count]) => (
              <li key={status} className="flex items-center justify-between gap-3">
                <span className="font-mono text-xs">{status}</span>
                <span className="tabular-nums text-muted-foreground">{String(count)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          This is the downloader&apos;s own in-memory view, which expires on its retention schedule.
          The Jobs tab shows the website&apos;s permanent record.
        </p>
      </div>
    </div>
  );
}
