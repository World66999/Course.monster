import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { callTelegram } from "./api";

/**
 * Telegram Stars donations.
 *
 * Contract, from the current Bot API:
 *  - Stars invoices use currency "XTR", an empty provider_token, and `prices`
 *    must contain exactly one item.
 *  - XTR is billed in whole Stars, so there are no minor units to convert.
 *  - A pre_checkout_query must be answered within seconds or the payment fails.
 *  - **A pre-checkout approval is not payment.** Only a successful_payment
 *    update may move a donation to COMPLETED.
 *
 * The amount is decided here from a validated integer and re-read from the
 * database at every later step; it is never taken from callback data, from the
 * pre-checkout payload, or from anything else the client controls.
 */

/** Whole Stars only. The upper bound keeps a typo from creating a huge invoice. */
export const MIN_STARS = 1;
export const MAX_STARS = 100_000;
export const SUGGESTED_STARS = [10, 25, 50, 100, 250, 500] as const;

export type AmountCheck = { ok: true; amount: number } | { ok: false; message: string };

/**
 * Parses a user-supplied Star amount. Deliberately strict: Telegram sends free
 * text, so anything that is not a plain positive integer is refused rather than
 * coerced (Number("12abc") style coercion is exactly how a wrong invoice gets
 * created).
 */
export function parseStarAmount(raw: string): AmountCheck {
  // Only outer whitespace is trimmed, and only thousands separators removed.
  // Stripping *internal* whitespace silently turned "5 5" into 55 — a wrong
  // invoice amount from an ambiguous message, which a payment path must refuse.
  const text = raw.trim().replace(/[,_]/g, "");
  if (!text) return { ok: false, message: "Send a number of Stars." };
  if (!/^\d{1,9}$/.test(text)) {
    // Rejects decimals, signs, exponents, hex, unicode digits and overflow.
    return { ok: false, message: "Send a whole number of Stars, digits only." };
  }
  const amount = Number(text);
  if (!Number.isSafeInteger(amount)) return { ok: false, message: "That number is too large." };
  if (amount < MIN_STARS) return { ok: false, message: `Minimum is ${MIN_STARS} Star.` };
  if (amount > MAX_STARS) return { ok: false, message: `Maximum is ${MAX_STARS.toLocaleString()} Stars.` };
  return { ok: true, amount };
}

/** Opaque, unguessable invoice reference. Carries no amount and no user data. */
function newPayload(): string {
  return `don_${randomBytes(18).toString("base64url")}`;
}

export interface InvoiceResult {
  ok: boolean;
  error?: string;
}

/**
 * Records a PENDING donation and sends the Stars invoice.
 *
 * The row is written first so that a successful_payment can always be matched
 * to a known amount — a payment that arrived for an unknown payload would
 * otherwise have to be trusted blindly.
 */
export async function createStarInvoice(opts: {
  chatId: string;
  telegramUserId: string;
  username?: string | null;
  amount: number;
  title: string;
  description: string;
}): Promise<InvoiceResult> {
  const check = parseStarAmount(String(opts.amount));
  if (!check.ok) return { ok: false, error: check.message };

  const payload = newPayload();
  await db.donation.create({
    data: {
      telegramUserId: opts.telegramUserId,
      telegramUsername: opts.username ?? null,
      amountStars: check.amount,
      currency: "XTR",
      status: "PENDING",
      invoicePayload: payload,
    },
  });

  const res = await callTelegram("sendInvoice", {
    chat_id: opts.chatId,
    title: opts.title.slice(0, 32),
    description: opts.description.slice(0, 255),
    payload,
    // Stars: empty provider token, XTR, exactly one price component.
    provider_token: "",
    currency: "XTR",
    prices: [{ label: `${check.amount} Stars`, amount: check.amount }],
  });

  if (!res.ok) {
    await db.donation.update({
      where: { invoicePayload: payload },
      data: { status: "FAILED", failureReason: res.description.slice(0, 200) },
    });
    return { ok: false, error: "Couldn't create the invoice. Please try again." };
  }
  return { ok: true };
}

export interface PreCheckout {
  id: string;
  from: { id: number; username?: string };
  currency: string;
  total_amount: number;
  invoice_payload: string;
}

/**
 * Validates a pre-checkout query against our own record.
 *
 * Telegram asks for a yes/no within seconds. We approve only when the payload
 * is one we issued, the currency is XTR, the amount matches what we recorded,
 * and the donation has not already been paid — so a tampered or replayed
 * checkout cannot be approved.
 */
export async function handlePreCheckout(q: PreCheckout): Promise<void> {
  const answer = (ok: boolean, error_message?: string) =>
    callTelegram("answerPreCheckoutQuery", {
      pre_checkout_query_id: q.id,
      ok,
      ...(error_message ? { error_message } : {}),
    });

  const donation = await db.donation.findUnique({ where: { invoicePayload: q.invoice_payload } });
  if (!donation) {
    await answer(false, "This donation link has expired. Please start again with /donate.");
    return;
  }
  if (donation.status === "COMPLETED") {
    await answer(false, "This donation was already paid.");
    return;
  }
  if (q.currency !== "XTR" || q.total_amount !== donation.amountStars) {
    console.warn("[telegram] pre-checkout mismatch for", donation.id);
    await answer(false, "Payment details didn't match. Please start again with /donate.");
    return;
  }

  await db.donation.update({
    where: { id: donation.id },
    data: { status: "PRECHECKOUT", telegramUsername: q.from.username ?? donation.telegramUsername },
  });
  await answer(true);
}

export interface SuccessfulPayment {
  currency: string;
  total_amount: number;
  invoice_payload: string;
  telegram_payment_charge_id: string;
  provider_payment_charge_id?: string;
}

export type CompletionResult =
  | { outcome: "completed"; amount: number; id: string }
  | { outcome: "duplicate" }
  | { outcome: "unknown" };

/**
 * Records a verified payment. Idempotent by Telegram's charge id, which is
 * unique in the schema: a redelivered update hits the constraint, is recognised
 * as a duplicate, and neither double-counts nor re-notifies.
 */
export async function completeDonation(
  p: SuccessfulPayment,
  /**
   * Who actually paid, from the `successful_payment` message's own `from`.
   *
   * An invoice is a normal message and can be forwarded, so the payer is not
   * necessarily whoever ran /donate. That matters beyond bookkeeping:
   * `refundStarPayment` takes a user_id, and Telegram will refuse a refund
   * aimed at anyone but the real payer — so recording the requester here would
   * make that donation permanently unrefundable. The payer is authenticated by
   * the webhook secret like every other field in the update.
   */
  payerTelegramId?: string
): Promise<CompletionResult> {
  const donation = await db.donation.findUnique({ where: { invoicePayload: p.invoice_payload } });
  if (!donation) {
    console.error("[telegram] successful payment for an unknown payload");
    return { outcome: "unknown" };
  }
  if (donation.telegramPaymentChargeId === p.telegram_payment_charge_id && donation.status === "COMPLETED") {
    return { outcome: "duplicate" };
  }

  if (payerTelegramId && payerTelegramId !== donation.telegramUserId) {
    console.warn(
      `[telegram] donation ${donation.id} was invoiced to one account and paid by another; ` +
        "recording the payer so a refund can reach them"
    );
  }

  try {
    const updated = await db.donation.update({
      where: { id: donation.id, status: { in: ["PENDING", "PRECHECKOUT"] } },
      data: {
        status: "COMPLETED",
        // The payer is the donor: attribution, per-donor stats and above all
        // the refund path must follow whoever Telegram actually charged.
        ...(payerTelegramId ? { telegramUserId: payerTelegramId } : {}),
        // Trust Telegram's figure for what was actually charged.
        amountStars: p.total_amount,
        currency: p.currency,
        telegramPaymentChargeId: p.telegram_payment_charge_id,
        providerPaymentChargeId: p.provider_payment_charge_id ?? null,
        completedAt: new Date(),
      },
    });
    return { outcome: "completed", amount: updated.amountStars, id: updated.id };
  } catch (err) {
    // P2002: the charge id is already recorded — a redelivered update.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { outcome: "duplicate" };
    }
    // P2025: the row was no longer PENDING/PRECHECKOUT, i.e. already handled.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return { outcome: "duplicate" };
    }
    throw err;
  }
}

/**
 * Refunds a completed donation. The charge id is read from our database, never
 * from the caller, so an arbitrary id can't be refunded.
 */
export async function refundDonation(donationId: string): Promise<{ ok: boolean; error?: string }> {
  const donation = await db.donation.findUnique({ where: { id: donationId } });
  if (!donation) return { ok: false, error: "Donation not found." };
  if (donation.status === "REFUNDED") return { ok: false, error: "That donation was already refunded." };
  if (donation.status !== "COMPLETED" || !donation.telegramPaymentChargeId) {
    return { ok: false, error: "Only a completed donation can be refunded." };
  }

  const res = await callTelegram("refundStarPayment", {
    user_id: Number(donation.telegramUserId),
    telegram_payment_charge_id: donation.telegramPaymentChargeId,
  });
  if (!res.ok) return { ok: false, error: `Telegram refused the refund: ${res.description}` };

  await db.donation.update({
    where: { id: donation.id },
    data: { status: "REFUNDED", refundedAt: new Date() },
  });
  return { ok: true };
}

export interface DonationStats {
  totalCompleted: number;
  totalStars: number;
  today: number;
  week: number;
  month: number;
  uniqueDonors: number;
  averageStars: number;
  largestStars: number;
  pending: number;
  failed: number;
  refunded: number;
}

/** Aggregates from COMPLETED rows only — invoice attempts are not income. */
export async function getDonationStats(): Promise<DonationStats> {
  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const week = new Date(now.getTime() - 7 * 864e5);
  const month = new Date(now.getTime() - 30 * 864e5);
  const completed = { status: "COMPLETED" as const };

  const [agg, todayC, weekC, monthC, donors, byStatus] = await Promise.all([
    db.donation.aggregate({ where: completed, _count: { _all: true }, _sum: { amountStars: true }, _avg: { amountStars: true }, _max: { amountStars: true } }),
    db.donation.count({ where: { ...completed, completedAt: { gte: startOfDay } } }),
    db.donation.count({ where: { ...completed, completedAt: { gte: week } } }),
    db.donation.count({ where: { ...completed, completedAt: { gte: month } } }),
    db.donation.groupBy({ by: ["telegramUserId"], where: completed, _count: { _all: true } }),
    db.donation.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const count = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0;

  return {
    totalCompleted: agg._count._all,
    totalStars: agg._sum.amountStars ?? 0,
    today: todayC,
    week: weekC,
    month: monthC,
    uniqueDonors: donors.length,
    averageStars: Math.round(agg._avg.amountStars ?? 0),
    largestStars: agg._max.amountStars ?? 0,
    pending: count("PENDING") + count("PRECHECKOUT"),
    failed: count("FAILED"),
    refunded: count("REFUNDED"),
  };
}

/** Server-side pagination; never loads the whole table. */
export async function listDonations(page: number, pageSize = 10) {
  const total = await db.donation.count();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // Clamp to the real last page: a page past the end previously returned an
  // empty list rather than the final page of results.
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const [items] = await Promise.all([
    db.donation.findMany({
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, telegramUserId: true, telegramUsername: true, amountStars: true,
        status: true, telegramPaymentChargeId: true, createdAt: true, completedAt: true,
      },
    }),
  ]);
  return { items, total, page: safePage, totalPages };
}


export interface Reconciliation {
  localStars: number;
  localCount: number;
  telegramStars: number | null;
  telegramCount: number | null;
  matches: boolean | null;
  note: string;
}

/**
 * Compares our completed totals against Telegram's own Star transaction
 * history. A mismatch is reported, never papered over: local figures are left
 * exactly as they are so the discrepancy stays visible.
 */
export async function reconcileDonations(): Promise<Reconciliation> {
  const agg = await db.donation.aggregate({
    where: { status: "COMPLETED" },
    _count: { _all: true },
    _sum: { amountStars: true },
  });
  const localStars = agg._sum.amountStars ?? 0;
  const localCount = agg._count._all;

  const res = await callTelegram<{ transactions: { amount?: number; source?: unknown }[] }>(
    "getStarTransactions",
    { offset: 0, limit: 100 }
  );
  if (!res.ok) {
    return {
      localStars,
      localCount,
      telegramStars: null,
      telegramCount: null,
      matches: null,
      note: `Telegram history unavailable: ${res.description}`,
    };
  }

  // Incoming transactions carry a `source`; outgoing (refunds/payouts) do not.
  const incoming = res.result.transactions.filter((t) => t.source);
  const telegramStars = incoming.reduce((n, t) => n + (t.amount ?? 0), 0);
  const matches = telegramStars === localStars;
  return {
    localStars,
    localCount,
    telegramStars,
    telegramCount: incoming.length,
    matches,
    note: matches
      ? "Local totals match Telegram's reported Star transactions."
      : "RECONCILIATION REQUIRED — local and Telegram totals differ (most recent 100 transactions).",
  };
}
