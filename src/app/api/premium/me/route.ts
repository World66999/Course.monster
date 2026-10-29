import { db } from "@/lib/db";
import { getViewer, jsonNoStore } from "@/server/premium-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { formatInr } from "@/lib/premium-plans";

/**
 * The signed-in viewer's Premium state, for client components on otherwise
 * static pages. Only ever describes the caller; never cached.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return jsonNoStore({ authenticated: false, premium: false });
  if (!checkRateLimit(`premium-me:${viewer.id}`, { limit: 120, windowMs: 60_000 }).ok) {
    return jsonNoStore({ error: "Too many requests" }, { status: 429 });
  }
  const [user, payments, razorpay] = await Promise.all([
    db.user.findUnique({
      where: { id: viewer.id },
      select: {
        telegramId: true,
        subscriptions: {
          where: { status: "ACTIVE" },
          orderBy: { expiresAt: "desc" },
          take: 1,
          select: { plan: true },
        },
      },
    }),
    db.payment.findMany({
      where: { userId: viewer.id, status: { in: ["FINISHED", "REFUNDED", "PARTIALLY_PAID"] } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, plan: true, priceAmount: true, payCurrency: true, status: true, createdAt: true },
    }),
    db.razorpayPayment.findMany({
      where: { userId: viewer.id, status: { in: ["PAID", "FLAGGED"] } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, plan: true, amount: true, status: true, createdAt: true },
    }),
  ]);
  const subscribed = Boolean(viewer.premiumUntil && viewer.premiumUntil.getTime() > Date.now());
  return jsonNoStore({
    authenticated: true,
    premium: viewer.premium,
    subscribed,
    staff: viewer.role !== "USER",
    premiumUntil: subscribed ? viewer.premiumUntil?.toISOString() : null,
    // Members whose time ran out (or was revoked) see "Expired" and a renew button.
    expiredAt: !subscribed && viewer.premiumUntil ? viewer.premiumUntil.toISOString() : null,
    plan: subscribed ? (user?.subscriptions[0]?.plan ?? null) : null,
    telegramLinked: Boolean(user?.telegramId),
    payments: [
      ...payments.map((p) => ({
        id: p.id,
        plan: p.plan,
        amount: p.priceAmount.toString(),
        coin: p.payCurrency,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      })),
      ...razorpay.map((p) => ({
        id: p.id,
        plan: p.plan,
        amount: (p.amount / 100).toString(),
        amountLabel: formatInr(p.amount),
        coin: "UPI / Card",
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      })),
    ]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 20),
  });
}
