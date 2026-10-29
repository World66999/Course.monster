import type { PlanKey } from "@/lib/premium-plans";
import { checkRateLimit } from "@/lib/rate-limit";
import { isOrderId, isPaymentId, isPaymentLinkId, type RzpPayment } from "@/lib/razorpay";

/**
 * Razorpay settlement rules, free of the database and the network so they can
 * be tested directly. src/lib/razorpay-payments.ts wires them to Prisma, the
 * Razorpay API and Telegram.
 *
 * Trust model (same as NOWPayments): our row is written before the buyer
 * sees an order or link and is the only authority on who pays, for which
 * plan and how much. A checkout callback or webhook can only *point at* a
 * payment; Premium is granted after Razorpay's own API confirms that payment
 * is captured, in INR, for exactly the row's amount and order — and the
 * unique payment id makes it impossible to grant twice.
 */

export type RowStatus = "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "CANCELLED" | "FLAGGED";

export interface RzpRow {
  id: string;
  userId: string;
  telegramId: string | null;
  plan: PlanKey;
  channel: "WEB" | "TELEGRAM";
  amount: number;
  currency: string;
  referenceId: string;
  orderId: string | null;
  paymentLinkId: string | null;
  paymentId: string | null;
  status: RowStatus;
  expiresAt: Date;
  fulfilledAt: Date | null;
}

// ---------------------------------------------------------------------------
// Rate limits
// ---------------------------------------------------------------------------

const TEN_MIN = 10 * 60_000;
/** New orders / links per user, and per IP (several users can share a mobile IP). */
export const CREATE_LIMIT_USER = 5;
export const CREATE_LIMIT_IP = 10;

export type LimitResult = { ok: true } | { ok: false; error: string };

function cooldown(retryAfterMs: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60_000));
  return `Too many payment attempts. Please wait ${minutes} minute${minutes === 1 ? "" : "s"} and try again.`;
}

/** Gate for creating a *new* Razorpay order or payment link. */
export function allowPaymentCreation(userKey: string, ipKey: string | null): LimitResult {
  const u = checkRateLimit(`rzp-create:${userKey}`, { limit: CREATE_LIMIT_USER, windowMs: TEN_MIN });
  if (!u.ok) return { ok: false, error: cooldown(u.retryAfterMs) };
  if (ipKey) {
    const i = checkRateLimit(`rzp-create-ip:${ipKey}`, { limit: CREATE_LIMIT_IP, windowMs: TEN_MIN });
    if (!i.ok) return { ok: false, error: cooldown(i.retryAfterMs) };
  }
  return { ok: true };
}

/** Looser gate on every attempt, including ones that only reuse an open order. */
export function allowPaymentAttempt(userKey: string): LimitResult {
  const r = checkRateLimit(`rzp-attempt:${userKey}`, { limit: 30, windowMs: TEN_MIN });
  return r.ok ? { ok: true } : { ok: false, error: cooldown(r.retryAfterMs) };
}

// ---------------------------------------------------------------------------
// Reuse
// ---------------------------------------------------------------------------

/** Keep this much validity when handing an open order/link back out. */
const REUSE_MARGIN_MS = 3 * 60_000;

/** An open row can be handed out again instead of creating another. */
export function isReusable(row: Pick<RzpRow, "status" | "expiresAt" | "fulfilledAt">, now = new Date()): boolean {
  return row.status === "PENDING" && !row.fulfilledAt && row.expiresAt.getTime() - now.getTime() > REUSE_MARGIN_MS;
}

// ---------------------------------------------------------------------------
// Judging a payment
// ---------------------------------------------------------------------------

export type Verdict =
  | { kind: "fulfil" }
  | { kind: "wait"; reason: string }
  | { kind: "flag"; reason: string }
  | { kind: "reject"; reason: string };

/**
 * Compares what Razorpay's API says about a payment with our row. The order
 * must match (otherwise it is someone else's payment pointed at this row);
 * then currency and amount must match exactly, or the row is flagged for an
 * admin rather than activated; then only "captured" activates.
 */
export function judgePayment(row: Pick<RzpRow, "orderId" | "amount" | "currency">, p: RzpPayment): Verdict {
  if (!row.orderId || p.order_id !== row.orderId) return { kind: "reject", reason: "order_mismatch" };
  if (p.status === "failed") return { kind: "reject", reason: "payment_failed" };
  if (p.status === "refunded") return { kind: "reject", reason: "payment_refunded" };
  if (row.currency !== "INR" || p.currency !== "INR") return { kind: "flag", reason: "currency_mismatch" };
  if (!Number.isSafeInteger(p.amount) || p.amount !== row.amount) return { kind: "flag", reason: "amount_mismatch" };
  if (p.status === "captured") return { kind: "fulfil" };
  return { kind: "wait", reason: `status_${String(p.status).slice(0, 20)}` };
}

// ---------------------------------------------------------------------------
// Settlement
// ---------------------------------------------------------------------------

export type FulfilResult = { result: "applied"; expiresAt: Date } | { result: "duplicate" } | { result: "replayed" };

export interface SettleDeps {
  fetchPayment(paymentId: string): Promise<RzpPayment>;
  /**
   * Atomically: mark the row PAID with this payment id (only if not yet
   * fulfilled) and add the Premium period. "replayed" = the payment id is
   * already bound to a different row (unique constraint).
   */
  fulfil(row: RzpRow, paymentId: string): Promise<FulfilResult>;
  flag(row: RzpRow, reason: string): Promise<void>;
  onApplied(row: RzpRow, paymentId: string, expiresAt: Date): Promise<void>;
  log(outcome: string, row: RzpRow | null, detail?: string): void;
}

export type SettleOutcome =
  | "applied"
  | "already_paid"
  | "duplicate"
  | "replayed"
  | "flagged"
  | "pending"
  | "rejected";

export async function settle(row: RzpRow, paymentId: string, deps: SettleDeps): Promise<{ outcome: SettleOutcome; reason?: string }> {
  if (!isPaymentId(paymentId)) return { outcome: "rejected", reason: "bad_payment_id" };
  if (row.fulfilledAt) {
    // Webhook + checkout callback, or a webhook retry: already done.
    const outcome = row.paymentId === paymentId ? "already_paid" : "duplicate";
    deps.log(outcome, row);
    return { outcome };
  }
  if (row.status === "FLAGGED") {
    deps.log("flagged_hold", row);
    return { outcome: "flagged" };
  }

  // Never trust the caller's description of the payment: ask Razorpay.
  const payment = await deps.fetchPayment(paymentId);
  const verdict = judgePayment(row, payment);
  if (verdict.kind === "reject") {
    deps.log("rejected", row, verdict.reason);
    return { outcome: "rejected", reason: verdict.reason };
  }
  if (verdict.kind === "wait") {
    deps.log("pending", row, verdict.reason);
    return { outcome: "pending", reason: verdict.reason };
  }
  if (verdict.kind === "flag") {
    await deps.flag(row, verdict.reason);
    deps.log("flagged", row, verdict.reason);
    return { outcome: "flagged", reason: verdict.reason };
  }

  const res = await deps.fulfil(row, paymentId);
  if (res.result === "applied") {
    deps.log("applied", row);
    await deps.onApplied(row, paymentId, res.expiresAt);
    return { outcome: "applied" };
  }
  deps.log(res.result, row);
  return { outcome: res.result };
}

// ---------------------------------------------------------------------------
// Checkout callback (website)
// ---------------------------------------------------------------------------

export interface CheckoutDeps extends SettleDeps {
  /** The caller's own row for this order, or null. */
  findOwnRow(orderId: string): Promise<RzpRow | null>;
  verifySignature(orderId: string, paymentId: string, signature: string): boolean;
}

export async function confirmCheckout(
  input: { orderId: unknown; paymentId: unknown; signature: unknown },
  deps: CheckoutDeps
): Promise<{ outcome: SettleOutcome | "not_found" | "bad_signature"; reason?: string }> {
  const { orderId, paymentId, signature } = input;
  if (!isOrderId(orderId) || !isPaymentId(paymentId) || typeof signature !== "string") {
    return { outcome: "bad_signature" };
  }
  const row = await deps.findOwnRow(orderId);
  if (!row) return { outcome: "not_found" };
  if (!deps.verifySignature(orderId, paymentId, signature)) {
    deps.log("bad_signature", row);
    return { outcome: "bad_signature" };
  }
  return settle(row, paymentId, deps);
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

export interface WebhookDeps extends SettleDeps {
  verifySignature(rawBody: string, signature: string | null): boolean;
  findByOrderId(orderId: string): Promise<RzpRow | null>;
  findByLinkId(linkId: string): Promise<RzpRow | null>;
  /** Binds the order Razorpay created for a payment link. False if it can't (taken / already set differently). */
  attachOrderId(row: RzpRow, orderId: string): Promise<boolean>;
  /** PENDING -> closed state; returns whether this call changed it. */
  close(row: RzpRow, status: "EXPIRED" | "CANCELLED"): Promise<boolean>;
  onClosed(row: RzpRow, status: "EXPIRED" | "CANCELLED"): Promise<void>;
  onPaymentFailed(row: RzpRow): Promise<void>;
  seenEvent(eventId: string): Promise<boolean>;
  recordEvent(eventId: string, event: string, entityId: string | null, outcome: string): Promise<void>;
}

export interface WebhookResult {
  httpStatus: number;
  outcome: string;
}

/** Events we act on. Everything else signed by Razorpay is acknowledged and ignored. */
export const HANDLED_EVENTS = [
  "payment.captured",
  "order.paid",
  "payment_link.paid",
  "payment.failed",
  "payment_link.expired",
  "payment_link.cancelled",
] as const;

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);
const entity = (payload: Obj | null, key: string): Obj | null => obj(obj(payload?.[key])?.entity);
const s = (v: unknown): string | null => (typeof v === "string" ? v : null);

/**
 * Handles one webhook delivery. The signature is checked against the raw
 * bytes before anything is parsed. Returns 200 for every correctly signed
 * event, including ones we ignore, so Razorpay stops retrying; it throws only
 * on transient faults (database, Razorpay API), which the route turns into a
 * 500 so Razorpay retries later. All processing is idempotent.
 */
export async function processWebhook(
  rawBody: string,
  signature: string | null,
  eventIdHeader: string | null,
  deps: WebhookDeps
): Promise<WebhookResult> {
  if (!deps.verifySignature(rawBody, signature)) {
    deps.log("bad_signature", null);
    return { httpStatus: 400, outcome: "bad_signature" };
  }

  let body: Obj | null;
  try {
    body = obj(JSON.parse(rawBody));
  } catch {
    body = null;
  }
  if (!body) return { httpStatus: 400, outcome: "malformed" };

  const event = s(body.event)?.slice(0, 60) ?? "";
  const eventId = eventIdHeader && /^[A-Za-z0-9_-]{1,64}$/.test(eventIdHeader) ? eventIdHeader : null;
  if (eventId && (await deps.seenEvent(eventId))) return { httpStatus: 200, outcome: "duplicate_event" };

  const payload = obj(body.payload);
  const pay = entity(payload, "payment");
  const order = entity(payload, "order");
  const link = entity(payload, "payment_link");

  let outcome: string;
  let entityId: string | null = null;

  switch (event) {
    case "payment.captured":
    case "order.paid": {
      const orderId = event === "order.paid" ? s(order?.id) : s(pay?.order_id);
      const paymentId = s(pay?.id);
      entityId = paymentId;
      if (!isOrderId(orderId) || !isPaymentId(paymentId)) {
        outcome = "ignored_malformed";
        break;
      }
      const row = await deps.findByOrderId(orderId);
      if (!row) {
        // A payment-link payment before payment_link.paid bound its order, or
        // not ours at all. Either way nothing to do here.
        outcome = "unknown_order";
        break;
      }
      outcome = (await settle(row, paymentId, deps)).outcome;
      break;
    }

    case "payment_link.paid": {
      const linkId = s(link?.id);
      const paymentId = s(pay?.id);
      entityId = linkId;
      if (!isPaymentLinkId(linkId) || !isPaymentId(paymentId)) {
        outcome = "ignored_malformed";
        break;
      }
      const row = await deps.findByLinkId(linkId);
      if (!row) {
        outcome = "unknown_link";
        break;
      }
      // The link itself must be the one we created, unchanged.
      if (link?.amount !== row.amount || link?.currency !== "INR" || s(link?.reference_id) !== row.referenceId) {
        if (!row.fulfilledAt) await deps.flag(row, "link_mismatch");
        deps.log("flagged", row, "link_mismatch");
        outcome = "flagged";
        break;
      }
      const orderId = s(pay?.order_id) ?? s(order?.id);
      if (!isOrderId(orderId)) {
        outcome = "ignored_malformed";
        break;
      }
      if (row.orderId !== orderId) {
        if (row.orderId || !(await deps.attachOrderId(row, orderId))) {
          deps.log("rejected", row, "order_mismatch");
          outcome = "rejected";
          break;
        }
        row.orderId = orderId;
      }
      outcome = (await settle(row, paymentId, deps)).outcome;
      break;
    }

    case "payment.failed": {
      const orderId = s(pay?.order_id);
      entityId = s(pay?.id);
      const row = isOrderId(orderId) ? await deps.findByOrderId(orderId) : null;
      if (!row) {
        outcome = "unknown_order";
        break;
      }
      // The order/link stays open: the buyer can simply try again.
      if (row.status === "PENDING" && !row.fulfilledAt) await deps.onPaymentFailed(row);
      outcome = "payment_failed";
      break;
    }

    case "payment_link.expired":
    case "payment_link.cancelled": {
      const linkId = s(link?.id);
      entityId = linkId;
      const row = isPaymentLinkId(linkId) ? await deps.findByLinkId(linkId) : null;
      if (!row) {
        outcome = "unknown_link";
        break;
      }
      const status = event === "payment_link.expired" ? "EXPIRED" : "CANCELLED";
      if (await deps.close(row, status)) {
        await deps.onClosed(row, status);
        outcome = status.toLowerCase();
      } else {
        outcome = "ignored_after_final";
      }
      break;
    }

    default:
      outcome = "ignored_event";
  }

  if (eventId) await deps.recordEvent(eventId, event || "unknown", entityId, outcome);
  return { httpStatus: 200, outcome };
}
