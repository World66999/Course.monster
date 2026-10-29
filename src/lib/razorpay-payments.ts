import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PLANS, NO_REFUND_NOTICE, formatInr, inrPaise, isPlanKey, type PlanKey } from "@/lib/premium-plans";
import { addPremiumPeriod } from "@/lib/premium";
import { onPremiumGained } from "@/lib/premium-lapse";
import { razorpayKeyId, supportTelegram, usdInrRate } from "@/lib/razorpay-config";
import {
  createOrder,
  createPaymentLink,
  fetchPayment,
  maskId,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from "@/lib/razorpay";
import {
  allowPaymentAttempt,
  allowPaymentCreation,
  confirmCheckout,
  isReusable,
  processWebhook,
  type CheckoutDeps,
  type FulfilResult,
  type RzpRow,
  type SettleDeps,
  type WebhookDeps,
  type WebhookResult,
} from "@/lib/razorpay-core";
import { siteUrl } from "@/lib/telegram/config";
import { sendMessage, type InlineKeyboard } from "@/lib/telegram/api";
import { notifyAdmins, notifyUser } from "@/lib/telegram/notify";
import { esc } from "@/lib/telegram/render";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Razorpay orders (website), Payment Links (Telegram bot), checkout
 * confirmation and the webhook — wired to Prisma, the Razorpay API and
 * Telegram. The rules themselves live in razorpay-core.ts.
 */

/** How long an order or payment link is offered for. */
export const PAYMENT_WINDOW_MS = 30 * 60_000;
export const BRAND_NAME = "Courses Monster";

const ROW_SELECT = {
  id: true,
  userId: true,
  telegramId: true,
  plan: true,
  channel: true,
  amount: true,
  currency: true,
  referenceId: true,
  orderId: true,
  paymentLinkId: true,
  paymentId: true,
  status: true,
  expiresAt: true,
  fulfilledAt: true,
} satisfies Prisma.RazorpayPaymentSelect;

type DbRow = Prisma.RazorpayPaymentGetPayload<{ select: typeof ROW_SELECT }>;
const toRow = (r: DbRow | null): RzpRow | null => r;

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function isUniqueViolation(err: unknown, field?: string): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") return false;
  if (!field) return true;
  const target = (err.meta as { target?: unknown } | undefined)?.target;
  return Array.isArray(target) ? target.includes(field) : String(target ?? "").includes(field);
}

/** Ids masked, never a body. */
function log(outcome: string, row: RzpRow | null, detail?: string): void {
  const quiet = outcome === "already_paid" || outcome === "pending";
  const line = `[razorpay] ${outcome}${row ? ` ref=${maskId(row.referenceId)} order=${maskId(row.orderId)} link=${maskId(row.paymentLinkId)}` : ""}${detail ? ` (${detail})` : ""}`;
  if (quiet) console.info(line);
  else console.warn(line);
}

export function planDescription(plan: PlanKey): string {
  const p = PLANS[plan];
  return `${BRAND_NAME} Premium — ${p.name} (1 ${p.periodLabel}). ${NO_REFUND_NOTICE}`;
}

export interface PlanPrice {
  plan: PlanKey;
  usd: number;
  paise: number;
  inrLabel: string;
}

/** Server-side price for a plan. The one place an INR amount is computed. */
export function planPrice(plan: PlanKey): PlanPrice {
  const usd = PLANS[plan].priceUsd;
  const paise = inrPaise(usd, usdInrRate());
  return { plan, usd, paise, inrLabel: formatInr(paise) };
}

// ---------------------------------------------------------------------------
// Creating orders and links
// ---------------------------------------------------------------------------

type OpenResult = { ok: true; row: DbRow & { shortUrl: string | null }; reused: boolean } | { ok: false; error: string };

const GENERIC_ERROR = "We couldn't start the payment just now. Please try again in a moment.";

function newReference(channel: "WEB" | "TELEGRAM"): string {
  // Opaque, unique, <= 40 chars (Razorpay's limit for receipt / reference_id).
  return `cv${channel === "WEB" ? "w" : "t"}_${randomBytes(12).toString("hex")}`;
}

async function openPayment(args: {
  userId: string;
  plan: unknown;
  channel: "WEB" | "TELEGRAM";
  telegramId?: string;
  ipKey: string | null;
}): Promise<OpenResult> {
  if (!isPlanKey(args.plan)) return { ok: false, error: "Unknown plan." };
  const plan = args.plan;
  const attempt = allowPaymentAttempt(`${args.channel}:${args.userId}`);
  if (!attempt.ok) return attempt;

  const select = { ...ROW_SELECT, shortUrl: true };
  const existing = await db.razorpayPayment.findFirst({
    where: { userId: args.userId, plan, channel: args.channel, status: "PENDING" },
    select: { ...select, createdAt: true },
  });
  if (existing) {
    const { createdAt, ...open } = existing;
    const ready = args.channel === "WEB" ? open.orderId : open.shortUrl;
    if (isReusable(open) && ready) return { ok: true, row: open, reused: true };
    if (!ready && Date.now() - createdAt.getTime() < 60_000) {
      return { ok: false, error: "Your payment is still being prepared. Please try again in a few seconds." };
    }
    // Too close to (or past) its expiry to hand out, or never finished being
    // created (process restart mid-request): close it so a fresh one can be
    // made. A payment that still lands on it is honoured anyway.
    await db.razorpayPayment.updateMany({
      where: { id: open.id, status: "PENDING" },
      data: { status: ready ? "EXPIRED" : "FAILED" },
    });
  }

  const gate = allowPaymentCreation(`${args.channel}:${args.userId}`, args.ipKey);
  if (!gate.ok) return gate;

  const price = planPrice(plan);
  const referenceId = newReference(args.channel);
  const expiresAt = new Date(Date.now() + PAYMENT_WINDOW_MS);
  let row: DbRow & { shortUrl: string | null };
  try {
    row = await db.razorpayPayment.create({
      data: {
        userId: args.userId,
        telegramId: args.telegramId ?? null,
        plan,
        channel: args.channel,
        amount: price.paise,
        currency: "INR",
        priceUsd: new Prisma.Decimal(price.usd.toFixed(2)),
        referenceId,
        status: "PENDING",
        expiresAt,
      },
      select,
    });
  } catch (err) {
    // The one-pending-per-plan index: a parallel click got there first.
    if (isUniqueViolation(err)) {
      return { ok: false, error: "Your payment is still being prepared. Please try again in a few seconds." };
    }
    throw err;
  }

  // Notes are visible in the Razorpay dashboard: internal ids and plan only.
  const notes: Record<string, string> = { ref: referenceId, plan, uid: args.userId };
  if (args.telegramId) notes.telegram_id = args.telegramId;

  try {
    if (args.channel === "WEB") {
      const order = await createOrder({ amount: price.paise, receipt: referenceId, notes });
      row = await db.razorpayPayment.update({ where: { id: row.id }, data: { orderId: order.id }, select });
    } else {
      const link = await createPaymentLink({
        amount: price.paise,
        referenceId,
        description: planDescription(plan),
        expireBy: expiresAt,
        notes,
      });
      row = await db.razorpayPayment.update({
        where: { id: row.id },
        data: { paymentLinkId: link.id, shortUrl: link.short_url },
        select,
      });
    }
    log("created", row);
    return { ok: true, row, reused: false };
  } catch (err) {
    console.error(`[razorpay] create ${args.channel} failed ref=${maskId(referenceId)}:`, err instanceof Error ? err.message : "unknown");
    await db.razorpayPayment.update({ where: { id: row.id }, data: { status: "FAILED" } }).catch(() => {});
    return { ok: false, error: GENERIC_ERROR };
  }
}

export type WebOrderResult =
  | {
      ok: true;
      keyId: string;
      orderId: string;
      amount: number;
      currency: "INR";
      name: string;
      description: string;
    }
  | { ok: false; error: string };

export async function createWebOrder(userId: string, plan: unknown, ipKey: string | null): Promise<WebOrderResult> {
  const res = await openPayment({ userId, plan, channel: "WEB", ipKey });
  if (!res.ok) return res;
  return {
    ok: true,
    keyId: razorpayKeyId(),
    orderId: res.row.orderId!,
    amount: res.row.amount,
    currency: "INR",
    name: BRAND_NAME,
    description: planDescription(res.row.plan),
  };
}

export type LinkResult =
  | { ok: true; url: string; amount: number; expiresAt: Date; reused: boolean; plan: PlanKey }
  | { ok: false; error: string };

export async function createTelegramLink(userId: string, telegramId: string, plan: unknown): Promise<LinkResult> {
  const res = await openPayment({ userId, plan, channel: "TELEGRAM", telegramId, ipKey: null });
  if (!res.ok) return res;
  return {
    ok: true,
    url: res.row.shortUrl!,
    amount: res.row.amount,
    expiresAt: res.row.expiresAt,
    reused: res.reused,
    plan: res.row.plan,
  };
}

// ---------------------------------------------------------------------------
// Settlement wiring
// ---------------------------------------------------------------------------

async function tell(row: RzpRow, text: string, keyboard?: InlineKeyboard): Promise<void> {
  try {
    if (row.telegramId) {
      await sendMessage(row.telegramId, text, { replyMarkup: keyboard });
    } else {
      await notifyUser(row.userId, text, keyboard);
    }
  } catch (err) {
    console.error("[razorpay] user notification failed:", err instanceof Error ? err.message : "unknown");
  }
}

function supportLine(): string {
  const s = supportTelegram();
  return s ? `\n\nNeed help? Message ${esc(s.handle)} on Telegram.` : "";
}

async function fulfil(row: RzpRow, paymentId: string): Promise<FulfilResult> {
  try {
    return await db.$transaction(async (tx) => {
      // The conditional update is the idempotency gate; the unique paymentId
      // stops one payment settling two rows.
      const { count } = await tx.razorpayPayment.updateMany({
        where: { id: row.id, fulfilledAt: null, status: { not: "FLAGGED" } },
        data: { status: "PAID", paymentId, fulfilledAt: new Date(), flagReason: null },
      });
      if (count !== 1) return { result: "duplicate" } as const;
      const period = await addPremiumPeriod(tx, {
        userId: row.userId,
        plan: row.plan,
        source: "PAYMENT",
        razorpayPaymentId: row.id,
      });
      return { result: "applied", expiresAt: period.expiresAt } as const;
    });
  } catch (err) {
    if (isUniqueViolation(err, "paymentId")) {
      await notifyAdmins(
        `🚩 Razorpay payment <code>${esc(maskId(paymentId))}</code> was presented for a second order (<code>${esc(maskId(row.referenceId))}</code>). Ignored.`
      );
      return { result: "replayed" };
    }
    throw err;
  }
}

async function flag(row: RzpRow, reason: string): Promise<void> {
  const { count } = await db.razorpayPayment.updateMany({
    where: { id: row.id, fulfilledAt: null, status: { not: "FLAGGED" } },
    data: { status: "FLAGGED", flagReason: reason.slice(0, 60) },
  });
  if (count === 1) {
    await notifyAdmins(
      `🚩 Razorpay payment flagged for review: <b>${esc(reason)}</b> (${esc(PLANS[row.plan].name)}, ref <code>${esc(maskId(row.referenceId))}</code>). Premium was not activated. See Admin → Razorpay.`
    );
  }
}

async function onApplied(row: RzpRow, paymentId: string, expiresAt: Date): Promise<void> {
  await onPremiumGained(row.userId).catch(() => {});
  const p = PLANS[row.plan];
  await tell(
    row,
    "✅ <b>Payment successful — Premium is active</b>\n\n" +
      "Thank you for your purchase.\n\n" +
      `Plan: <b>${esc(p.name)}</b>\n` +
      `Amount: <b>${esc(formatInr(row.amount))}</b>\n` +
      `Valid until: <b>${DATE.format(expiresAt)}</b>\n` +
      `Payment ID: <code>${esc(paymentId)}</code>` +
      supportLine(),
    [[{ text: "👑 Open Premium", url: `${siteUrl()}/premium-resources` }]]
  );
  await notifyAdmins(
    `💰 Razorpay payment: <b>${esc(p.name)}</b> (${esc(formatInr(row.amount))}, ${row.channel === "TELEGRAM" ? "bot" : "website"}) — active until ${expiresAt.toISOString().slice(0, 10)}.`
  );
}

/** Claims the one-time "we told the buyer" slot, so expiry/failure is never sent twice. */
async function claimNotice(rowId: string): Promise<boolean> {
  const { count } = await db.razorpayPayment.updateMany({ where: { id: rowId, notifiedAt: null }, data: { notifiedAt: new Date() } });
  return count === 1;
}

async function onClosed(row: RzpRow, status: "EXPIRED" | "CANCELLED"): Promise<void> {
  if (row.channel !== "TELEGRAM" || !(await claimNotice(row.id))) return;
  await tell(
    row,
    (status === "EXPIRED"
      ? "⌛ <b>Payment link expired</b>\n\nYour payment link for "
      : "🚫 <b>Payment link cancelled</b>\n\nYour payment link for ") +
      `Premium ${esc(PLANS[row.plan].name)} is no longer valid, and no money was taken. ` +
      "Send /premium whenever you'd like a new one." +
      supportLine()
  );
}

async function onPaymentFailed(row: RzpRow): Promise<void> {
  if (row.channel !== "TELEGRAM") return; // the website shows this in the checkout itself
  if (!checkRateLimit(`rzp-failed-notice:${row.id}`, { limit: 2, windowMs: 10 * 60_000 }).ok) return;
  await tell(
    row,
    "❌ <b>Payment didn't go through</b>\n\n" +
      "Nothing was charged for this attempt. If your bank shows a debit, it is reversed automatically by your bank. " +
      "You can try again with the same link until it expires." +
      supportLine()
  );
}

function settleDeps(): SettleDeps {
  return { fetchPayment, fulfil, flag, onApplied, log };
}

// ---------------------------------------------------------------------------
// Checkout callback
// ---------------------------------------------------------------------------

export type ConfirmResult =
  | { ok: true; state: "paid" | "pending" }
  | { ok: false; error: string };

export async function confirmWebCheckout(
  userId: string,
  input: { orderId: unknown; paymentId: unknown; signature: unknown }
): Promise<ConfirmResult> {
  const deps: CheckoutDeps = {
    ...settleDeps(),
    findOwnRow: async (orderId) =>
      toRow(await db.razorpayPayment.findFirst({ where: { orderId, userId, channel: "WEB" }, select: ROW_SELECT })),
    verifySignature: (orderId, paymentId, signature) => verifyCheckoutSignature(orderId, paymentId, signature),
  };
  const res = await confirmCheckout(input, deps);
  switch (res.outcome) {
    case "applied":
    case "already_paid":
      return { ok: true, state: "paid" };
    case "pending":
      return { ok: true, state: "pending" };
    case "flagged":
      return { ok: false, error: "We couldn't confirm this payment automatically. Our team will review it shortly — please contact support with your payment ID." };
    case "not_found":
      return { ok: false, error: "We couldn't find that order on your account." };
    default:
      return { ok: false, error: "We couldn't verify this payment. If money was taken, contact support with your payment ID." };
  }
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

export function handleRazorpayWebhook(rawBody: string, signature: string | null, eventId: string | null): Promise<WebhookResult> {
  const deps: WebhookDeps = {
    ...settleDeps(),
    verifySignature: (raw, sig) => verifyWebhookSignature(raw, sig),
    findByOrderId: async (orderId) => toRow(await db.razorpayPayment.findUnique({ where: { orderId }, select: ROW_SELECT })),
    findByLinkId: async (paymentLinkId) =>
      toRow(await db.razorpayPayment.findUnique({ where: { paymentLinkId }, select: ROW_SELECT })),
    attachOrderId: async (row, orderId) => {
      try {
        const { count } = await db.razorpayPayment.updateMany({ where: { id: row.id, orderId: null }, data: { orderId } });
        return count === 1;
      } catch (err) {
        if (isUniqueViolation(err)) return false;
        throw err;
      }
    },
    close: async (row, status) => {
      const { count } = await db.razorpayPayment.updateMany({
        where: { id: row.id, status: "PENDING", fulfilledAt: null },
        data: { status },
      });
      return count === 1;
    },
    onClosed,
    onPaymentFailed,
    seenEvent: async (eventId) => Boolean(await db.razorpayWebhookEvent.findUnique({ where: { eventId }, select: { id: true } })),
    recordEvent: async (eventId, event, entityId, outcome) => {
      try {
        await db.razorpayWebhookEvent.create({
          data: { eventId, event: event.slice(0, 60), entityId: entityId?.slice(0, 64) ?? null, outcome: outcome.slice(0, 40) },
        });
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
      }
    },
  };
  return processWebhook(rawBody, signature, eventId, deps);
}

// ---------------------------------------------------------------------------
// Housekeeping
// ---------------------------------------------------------------------------

/** Grace after expiresAt before we call a link dead (a last-second payment still settles). */
const SWEEP_GRACE_MS = 5 * 60_000;

/**
 * Closes open payments past their window and tells bot buyers their link
 * expired. Runs from the Premium scheduler; the payment_link.expired webhook
 * usually gets there first, and the notice is claimed once either way.
 */
export async function sweepExpiredRazorpay(now = new Date()): Promise<number> {
  const stale = await db.razorpayPayment.findMany({
    where: { status: "PENDING", expiresAt: { lt: new Date(now.getTime() - SWEEP_GRACE_MS) } },
    select: ROW_SELECT,
    take: 200,
  });
  let closed = 0;
  for (const row of stale) {
    const { count } = await db.razorpayPayment.updateMany({
      where: { id: row.id, status: "PENDING", fulfilledAt: null },
      data: { status: "EXPIRED" },
    });
    if (count !== 1) continue;
    closed++;
    await onClosed(row, "EXPIRED");
  }
  return closed;
}
