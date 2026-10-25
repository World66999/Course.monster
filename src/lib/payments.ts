import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma, type PaymentStatus, type PremiumPlan } from "@prisma/client";
import { db } from "@/lib/db";
import { PLANS, isPlanKey, type PlanKey } from "@/lib/premium-plans";
import { addPremiumPeriod, rechainPremium } from "@/lib/premium";
import {
  availableCoins,
  candidateCoins,
  coinSupportsPrice,
  createInvoice,
  verifyIpnSignature,
} from "@/lib/nowpayments";
import { siteUrl } from "@/lib/telegram/config";
import { notifyAdmins, notifyUser } from "@/lib/telegram/notify";
import { esc } from "@/lib/telegram/render";

/**
 * Checkout and IPN processing.
 *
 * Trust model: our Payment row is written *before* the invoice exists and is
 * the only authority on who is paying, for which plan, and how much. An IPN
 * can move that row through NOWPayments' states, but every field it carries
 * is checked against the row first, and Premium is only ever granted from the
 * row's own plan — never from anything in the webhook body.
 */

/** Unpaid invoices one user may hold at once. Stops invoice spam. */
export const MAX_PENDING_INVOICES = 3;
/** An unpaid invoice older than this no longer counts toward the cap. */
const PENDING_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Reuse an identical unpaid invoice created this recently instead of minting another. */
const REUSE_WINDOW_MS = 30 * 60 * 1000;

const OPEN_STATUSES: PaymentStatus[] = ["PENDING", "WAITING", "CONFIRMING", "CONFIRMED", "SENDING"];

export type CheckoutResult =
  | { ok: true; invoiceUrl: string; orderId: string }
  | { ok: false; error: string };

function newOrderId(plan: PlanKey): string {
  // Opaque and unguessable. The plan prefix is only a readability aid in the
  // NOWPayments dashboard; the server never reads the plan back out of it.
  return `cv-${plan === "YEARLY" ? "y" : "m"}-${randomBytes(12).toString("hex")}`;
}

export async function createCheckout(args: {
  userId: string;
  plan: unknown;
  coin: unknown;
}): Promise<CheckoutResult> {
  if (!isPlanKey(args.plan)) return { ok: false, error: "Unknown plan." };
  const plan = PLANS[args.plan];
  const coin = typeof args.coin === "string" ? args.coin.toLowerCase() : "";
  if (!candidateCoins().includes(coin)) return { ok: false, error: "That coin is not offered." };

  const user = await db.user.findUnique({ where: { id: args.userId }, select: { disabled: true } });
  if (!user || user.disabled) return { ok: false, error: "Your account is unavailable." };

  const coins = await availableCoins();
  const meta = coins.find((c) => c.ticker === coin);
  if (!meta) {
    return { ok: false, error: "Crypto payments are temporarily unavailable. Please try again in a few minutes." };
  }
  if (!coinSupportsPrice(meta, plan.priceUsd)) {
    return {
      ok: false,
      error: `${meta.label} on ${meta.network} can't take a $${plan.priceUsd} payment right now (its minimum is about $${meta.minUsd?.toFixed(2) ?? "?"}). Please pick another coin.`,
    };
  }

  const since = new Date(Date.now() - PENDING_WINDOW_MS);
  const open = await db.payment.findMany({
    where: { userId: args.userId, status: { in: OPEN_STATUSES }, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: { orderId: true, plan: true, payCurrency: true, invoiceUrl: true, createdAt: true },
  });

  const reusable = open.find(
    (p) =>
      p.plan === plan.key &&
      p.payCurrency === coin &&
      p.invoiceUrl &&
      Date.now() - p.createdAt.getTime() < REUSE_WINDOW_MS
  );
  if (reusable?.invoiceUrl) return { ok: true, invoiceUrl: reusable.invoiceUrl, orderId: reusable.orderId };

  if (open.length >= MAX_PENDING_INVOICES) {
    return {
      ok: false,
      error: `You already have ${open.length} unpaid invoices. Finish one of them, or wait for them to expire, before creating another.`,
    };
  }

  const orderId = newOrderId(plan.key);
  const payment = await db.payment.create({
    data: {
      orderId,
      userId: args.userId,
      plan: plan.key,
      priceAmount: new Prisma.Decimal(plan.priceUsd.toFixed(2)),
      priceCurrency: "usd",
      payCurrency: coin,
      status: "PENDING",
    },
  });

  const base = siteUrl();
  try {
    const invoice = await createInvoice({
      priceAmount: plan.priceUsd,
      priceCurrency: "usd",
      payCurrency: coin,
      orderId,
      orderDescription: `Courses Monster Premium — ${plan.name}`,
      ipnCallbackUrl: `${base}/api/payments/nowpayments/ipn`,
      successUrl: `${base}/premium/success?order=${encodeURIComponent(orderId)}`,
      cancelUrl: `${base}/premium?cancelled=1`,
    });
    await db.payment.update({
      where: { id: payment.id },
      data: { invoiceId: invoice.id, invoiceUrl: invoice.url, status: "WAITING" },
    });
    await logEvent({ paymentId: payment.id, orderId, signatureValid: true, outcome: "invoice_created" });
    return { ok: true, invoiceUrl: invoice.url, orderId };
  } catch (err) {
    console.error("[payments] invoice creation failed:", err instanceof Error ? err.message : err);
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    await logEvent({
      paymentId: payment.id,
      orderId,
      signatureValid: true,
      outcome: "invoice_failed",
      detail: err instanceof Error ? err.message.slice(0, 200) : "unknown",
    });
    return { ok: false, error: "We couldn't create the invoice. Please try again in a moment." };
  }
}

// ---------------------------------------------------------------------------
// IPN
// ---------------------------------------------------------------------------

const NP_STATUS: Record<string, PaymentStatus> = {
  waiting: "WAITING",
  confirming: "CONFIRMING",
  confirmed: "CONFIRMED",
  sending: "SENDING",
  partially_paid: "PARTIALLY_PAID",
  finished: "FINISHED",
  failed: "FAILED",
  expired: "EXPIRED",
  refunded: "REFUNDED",
};

/** Fields we keep from an IPN body. Whitelisted, so nothing unexpected is stored. */
const STORED_FIELDS = [
  "payment_id",
  "invoice_id",
  "payment_status",
  "order_id",
  "price_amount",
  "price_currency",
  "pay_amount",
  "actually_paid",
  "pay_currency",
  "outcome_amount",
  "outcome_currency",
  "purchase_id",
  "updated_at",
] as const;

function storedPayload(body: Record<string, unknown>): Prisma.InputJsonValue {
  const out: Record<string, string | number | null> = {};
  for (const key of STORED_FIELDS) {
    const v = body[key];
    if (typeof v === "string") out[key] = v.slice(0, 200);
    else if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
    else if (v === null) out[key] = null;
  }
  return out;
}

type EventBase = Omit<Parameters<typeof logEvent>[0], "outcome">;

async function logEvent(e: {
  paymentId?: string | null;
  orderId?: string | null;
  npPaymentId?: string | null;
  npStatus?: string | null;
  signatureValid: boolean;
  outcome: string;
  detail?: string;
  payload?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await db.paymentEvent.create({
      data: {
        paymentId: e.paymentId ?? null,
        orderId: e.orderId?.slice(0, 100) ?? null,
        npPaymentId: e.npPaymentId?.slice(0, 64) ?? null,
        npStatus: e.npStatus?.slice(0, 32) ?? null,
        signatureValid: e.signatureValid,
        outcome: e.outcome,
        detail: e.detail?.slice(0, 300) ?? null,
        payload: e.payload,
      },
    });
  } catch (err) {
    console.error("[payments] failed to write payment event:", err instanceof Error ? err.message : err);
  }
}

function toCents(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function str(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export interface IpnResult {
  httpStatus: number;
  outcome: string;
}

/**
 * Handles one IPN delivery. Returns 200 for anything correctly signed (even
 * when we ignore it), so NOWPayments stops retrying a message we have already
 * judged; 400/401 only for bodies that are malformed or not from them.
 */
export async function processIpn(rawBody: string, signature: string | null): Promise<IpnResult> {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    await logEvent({ signatureValid: false, outcome: "malformed" });
    return { httpStatus: 400, outcome: "malformed" };
  }

  const orderId = str(body.order_id);
  const npPaymentId = str(body.payment_id);
  const npStatusRaw = str(body.payment_status)?.toLowerCase() ?? null;

  if (!verifyIpnSignature(body, signature)) {
    // Not stored: an unsigned body is attacker-controlled text.
    await logEvent({ orderId, npStatus: npStatusRaw, signatureValid: false, outcome: "bad_signature" });
    return { httpStatus: 401, outcome: "bad_signature" };
  }

  const payload = storedPayload(body);
  const base = { orderId, npPaymentId, npStatus: npStatusRaw, signatureValid: true, payload };

  const status = npStatusRaw ? NP_STATUS[npStatusRaw] : undefined;
  if (!orderId || !status) {
    await logEvent({ ...base, outcome: "ignored_unknown_status" });
    return { httpStatus: 200, outcome: "ignored_unknown_status" };
  }

  const payment = await db.payment.findUnique({ where: { orderId } });
  if (!payment) {
    await logEvent({ ...base, outcome: "unknown_order" });
    return { httpStatus: 200, outcome: "unknown_order" };
  }

  // Cross-check against our own record. Any disagreement means this is not
  // the payment we created, whatever the signature says, so it changes nothing.
  const mismatches: string[] = [];
  if (toCents(body.price_amount) !== toCents(payment.priceAmount.toString())) mismatches.push("price_amount");
  if (str(body.price_currency)?.toLowerCase() !== payment.priceCurrency.toLowerCase()) mismatches.push("price_currency");
  const invoiceId = str(body.invoice_id);
  if (payment.invoiceId && invoiceId && invoiceId !== payment.invoiceId) mismatches.push("invoice_id");
  if (!isPlanKey(payment.plan) || toCents(PLANS[payment.plan].priceUsd) !== toCents(payment.priceAmount.toString())) {
    mismatches.push("plan");
  }
  if (mismatches.length > 0) {
    await logEvent({ ...base, paymentId: payment.id, outcome: "mismatch", detail: mismatches.join(",") });
    return { httpStatus: 200, outcome: "mismatch" };
  }

  const actuallyPaid = str(body.actually_paid);
  const actuallyPaidDecimal =
    actuallyPaid && Number.isFinite(Number(actuallyPaid)) ? new Prisma.Decimal(actuallyPaid) : undefined;

  if (status === "FINISHED") return finishPayment(payment.id, payment.userId, payment.plan, npPaymentId, actuallyPaidDecimal, base);
  if (status === "REFUNDED") return refundPayment(payment.id, payment.userId, npPaymentId, base);

  // Intermediate and failure states. A fulfilled or refunded payment never
  // moves backwards: a late "confirming" for a finished payment changes nothing.
  const { count } = await db.payment.updateMany({
    where: { id: payment.id, fulfilledAt: null, refundedAt: null },
    data: { status, npPaymentId: npPaymentId ?? undefined, actuallyPaid: actuallyPaidDecimal },
  });
  const outcome = count === 1 ? `status_${npStatusRaw}` : "ignored_after_final";
  await logEvent({ ...base, paymentId: payment.id, outcome });

  if (count === 1 && status === "PARTIALLY_PAID") {
    await notifyUser(
      payment.userId,
      "⚠️ <b>Payment incomplete</b>\n\nWe received less than the invoice amount, so Premium is not active yet. " +
        `Please open <a href="${siteUrl()}/premium/support">Premium Purchase Support</a> and we'll sort it out.`
    );
    await notifyAdmins(
      `⚠️ Partial payment for order <code>${esc(payment.orderId)}</code> (${esc(payment.plan)}, paid ${esc(actuallyPaid ?? "?")} ${esc(payment.payCurrency)}).`
    );
  }
  return { httpStatus: 200, outcome };
}

async function finishPayment(
  paymentId: string,
  userId: string,
  plan: PremiumPlan,
  npPaymentId: string | null,
  actuallyPaid: Prisma.Decimal | undefined,
  base: EventBase
): Promise<IpnResult> {
  // The conditional update on fulfilledAt is the idempotency gate: exactly one
  // delivery can flip it, and the subscription is created in the same
  // transaction, so a replayed or concurrent IPN can never grant time twice.
  const result = await db.$transaction(async (tx) => {
    const { count } = await tx.payment.updateMany({
      where: { id: paymentId, fulfilledAt: null, refundedAt: null },
      data: {
        status: "FINISHED",
        fulfilledAt: new Date(),
        npPaymentId: npPaymentId ?? undefined,
        actuallyPaid,
      },
    });
    if (count !== 1) return null;
    return addPremiumPeriod(tx, { userId, plan, source: "PAYMENT", paymentId });
  });

  if (!result) {
    await logEvent({ ...base, paymentId, outcome: "duplicate" });
    return { httpStatus: 200, outcome: "duplicate" };
  }
  await logEvent({ ...base, paymentId, outcome: "applied" });

  const until = result.expiresAt.toISOString().slice(0, 10);
  await notifyUser(
    userId,
    `👑 <b>Premium is active!</b>\n\nThank you for upgrading. Your ${PLANS[plan].name.toLowerCase()} plan runs until <b>${until}</b>.\n\n` +
      `Open <a href="${siteUrl()}/premium">your Premium page</a> to get started.`
  );
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  await notifyAdmins(
    `💰 New Premium payment: <b>${esc(PLANS[plan].name)}</b> ($${PLANS[plan].priceUsd}) by ${esc(user?.email ?? userId)} — active until ${until}.`
  );
  return { httpStatus: 200, outcome: "applied" };
}

async function refundPayment(
  paymentId: string,
  userId: string,
  npPaymentId: string | null,
  base: EventBase
): Promise<IpnResult> {
  const changed = await db.$transaction(async (tx) => {
    const { count } = await tx.payment.updateMany({
      where: { id: paymentId, refundedAt: null },
      data: { status: "REFUNDED", refundedAt: new Date(), npPaymentId: npPaymentId ?? undefined },
    });
    if (count !== 1) return false;
    // Take back exactly the period this payment bought, then re-chain the rest.
    const { count: subs } = await tx.subscription.updateMany({
      where: { paymentId, status: { in: ["ACTIVE", "EXPIRED"] } },
      data: { status: "REFUNDED" },
    });
    if (subs > 0) await rechainPremium(tx, userId);
    return true;
  });
  const outcome = changed ? "refunded" : "duplicate";
  await logEvent({ ...base, paymentId, outcome });
  if (changed) {
    await notifyAdmins(`↩️ Payment refunded for user ${esc(userId)}; their Premium time was adjusted.`);
  }
  return { httpStatus: 200, outcome };
}
