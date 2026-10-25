import { BarChart3, HeartPulse, Users } from "lucide-react";
import type { Metadata } from "next";
import { getOverview } from "@/lib/telegram/analytics";
import { getWebhookInfo } from "@/lib/telegram/api";
import { hasBotToken } from "@/lib/telegram/config";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { BotControls } from "@/components/admin/telegram/bot-controls";

export const metadata: Metadata = { title: "Telegram bot" };
export const dynamic = "force-dynamic";

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-card border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground uppercase">{label}</p>
      <p className="numeric mt-1 text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default async function TelegramOverviewPage() {
  const configured = hasBotToken();
  const [overview, courseCount] = await Promise.all([
    getOverview(),
    db.course.count({ where: { published: true } }),
  ]);
  // Telegram's own health signal rather than an invented one.
  const webhook = configured ? await getWebhookInfo() : null;

  return (
    <div className="space-y-6">
      {!configured && (
        <div className="rounded-card border border-warning/40 bg-warning/10 p-4 text-sm">
          <p className="font-medium">The bot token is not configured on this server.</p>
          <p className="mt-1 text-muted-foreground">
            Set <code>TELEGRAM_BOT_TOKEN</code> in the server environment, then restart the app.
            The bot is inert until then; nothing else on the site is affected.
          </p>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold"><HeartPulse className="h-4 w-4 text-primary" aria-hidden />Health</h2>
        <div className="rounded-card border border-border bg-card p-4 text-sm">
          {!configured ? (
            <p className="text-muted-foreground">Not configured.</p>
          ) : webhook?.ok ? (
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground uppercase">Webhook</dt>
                <dd className="mt-1">
                  {webhook.result.url ? (
                    <Badge variant="success">Registered</Badge>
                  ) : (
                    <Badge variant="secondary">Not registered</Badge>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground uppercase">Pending updates</dt>
                <dd className="mt-1 font-medium">{webhook.result.pending_update_count}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground uppercase">Last Telegram error</dt>
                <dd className="mt-1">
                  {webhook.result.last_error_message ? (
                    <span className="text-destructive">
                      {webhook.result.last_error_message}
                      {webhook.result.last_error_date
                        ? ` (${formatDate(new Date(webhook.result.last_error_date * 1000))})`
                        : ""}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground uppercase">Last bot activity</dt>
                <dd className="mt-1 font-medium">
                  {overview.lastActivityAt ? formatDate(overview.lastActivityAt) : "—"}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-destructive">
              Couldn&apos;t reach Telegram: {webhook?.description ?? "unknown error"}
            </p>
          )}
        </div>
        <BotControls configured={configured} />
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4 text-primary" aria-hidden />Users</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Total bot users" value={overview.totalUsers} />
          <Stat label="Active (7 days)" value={overview.activeUsers} />
          <Stat label="New today" value={overview.newToday} />
          <Stat label="New this week" value={overview.newThisWeek} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold"><BarChart3 className="h-4 w-4 text-primary" aria-hidden />Activity</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Course views" value={overview.courseViews} />
          <Stat label="Searches" value={overview.searches} />
          <Stat label="Upcoming views" value={overview.upcomingViews} />
          <Stat label="Published courses served" value={courseCount} hint="Live from the website catalog" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">⬇️ Download funnel</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Download requested" value={overview.downloadRequests} hint="Download button pressed in the bot" />
          <Stat
            label="Completed downloads"
            value={overview.completedDownloads}
            hint="Verification passed and the redirect was issued"
          />
          <Stat label="View → request" value={`${overview.viewToRequestRate}%`} />
          <Stat label="Request → completed" value={`${overview.requestToDownloadRate}%`} />
        </div>
        <p className="text-xs text-muted-foreground">
          &ldquo;Completed&rdquo; counts downloads recorded by the website&apos;s own download flow after the
          verification gateway passed — the bot only ever hands over the protected link, so it
          cannot and does not claim a download succeeded on its own.
        </p>
      </section>
    </div>
  );
}
