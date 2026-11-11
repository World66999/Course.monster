import type { Metadata } from "next";
import Link from "next/link";
import { getSiteSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/settings-form";
import { db } from "@/lib/db";
import { adminPath } from "@/lib/admin-path";
import { effectiveDailyLimit, effectiveIpDailyCap, istDay, PROVIDER_LABEL } from "@/lib/shortener-core";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

/** Today's (IST) free unlocks per user, busiest first. */
async function FreeUnlocksToday({ limit, ipCap }: { limit: number; ipCap: number }) {
  const today = istDay();
  const [quotas, byProvider] = await Promise.all([
    db.freeUnlockQuota.findMany({
      where: { day: today, count: { gt: 0 } },
      orderBy: [{ count: "desc" }, { updatedAt: "desc" }],
      take: 100,
    }),
    db.freeUnlock.groupBy({ by: ["provider"], where: { day: today }, _count: { _all: true } }),
  ]);
  const userIds = quotas.filter((q) => q.subjectKey.startsWith("u:")).map((q) => q.subjectKey.slice(2));
  const tgIds = quotas.filter((q) => q.subjectKey.startsWith("tg:")).map((q) => q.subjectKey.slice(3));
  const [users, tgUsers] = await Promise.all([
    userIds.length
      ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, name: true } })
      : [],
    tgIds.length
      ? db.telegramUser.findMany({
          where: { telegramId: { in: tgIds } },
          select: { telegramId: true, username: true, firstName: true },
        })
      : [],
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const tgById = new Map(tgUsers.map((u) => [u.telegramId, u]));
  const total = byProvider.reduce((n, r) => n + r._count._all, 0);

  return (
    <section className="space-y-4 rounded-card border border-border bg-card p-6">
      <div>
        <h2 className="font-semibold">Free unlocks today ({today}, IST)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {total} unlock{total === 1 ? "" : "s"} today
          {byProvider.length > 0 &&
            ` — ${byProvider.map((r) => `${PROVIDER_LABEL[r.provider as keyof typeof PROVIDER_LABEL] ?? r.provider}: ${r._count._all}`).join(", ")}`}
          . Limit {limit}/day per user, {ipCap}/day per IP for anonymous visitors.
        </p>
      </div>
      {quotas.length === 0 ? (
        <p className="text-sm text-muted-foreground">No free unlocks yet today.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">User</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 font-medium">Used today</th>
              </tr>
            </thead>
            <tbody>
              {quotas.map((q) => {
                const [kind, id = ""] = [q.subjectKey.slice(0, q.subjectKey.indexOf(":")), q.subjectKey.slice(q.subjectKey.indexOf(":") + 1)];
                let who: React.ReactNode = id;
                let type = kind;
                if (kind === "u") {
                  const u = userById.get(id);
                  who = (
                    <Link prefetch={false} href={adminPath(`users/${id}`)} className="text-primary hover:underline">
                      {u?.email ?? u?.name ?? id}
                    </Link>
                  );
                  type = "Account";
                } else if (kind === "tg") {
                  const t = tgById.get(id);
                  who = t?.username ? `@${t.username}` : (t?.firstName ?? `Telegram ${id}`);
                  type = "Telegram";
                } else if (kind === "d") {
                  who = `Device …${id.slice(-6)}`;
                  type = "Website (device)";
                } else if (kind === "ip") {
                  who = `Visitor …${id.slice(-6)}`;
                  type = "Website (IP, old)";
                } else if (kind === "ipcap") {
                  who = `Network …${id.slice(-6)}`;
                  type = "IP backup cap";
                }
                return (
                  <tr key={q.subjectKey} className="border-t border-border">
                    <td className="py-2 pr-4">{who}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{type}</td>
                    <td className="py-2 tabular-nums">
                      {q.count}/{kind === "ipcap" ? ipCap : limit}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function AdminSettingsPage() {
  const settings = await getSiteSettings();
  const envLimit = effectiveDailyLimit(null, process.env.FREE_DAILY_COURSE_LIMIT);
  const limit = effectiveDailyLimit(settings.freeUnlocks?.dailyLimit ?? null, process.env.FREE_DAILY_COURSE_LIMIT);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading">Website settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything here applies site-wide without touching code.
        </p>
      </div>
      <SettingsForm defaultValues={settings} freeLimitDefault={envLimit} />
      <FreeUnlocksToday limit={limit} ipCap={effectiveIpDailyCap(settings.freeUnlocks?.ipDailyCap)} />
    </div>
  );
}
