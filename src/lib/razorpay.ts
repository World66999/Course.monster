import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { razorpayKeyId, razorpayKeySecret, razorpayWebhookSecret } from "@/lib/razorpay-config";

/**
 * Razorpay REST client and signature checks (server only).
 *
 * Credentials travel only in the Authorization header of requests to
 * Razorpay's HTTPS API. Errors carry Razorpay's own short description, never
 * a header, a request body or a secret.
 */

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;

export function apiBase(): string {
  // Overridable so tests can point the client at a local mock; same trust
  // level as the keys themselves (server env only). Anything but loopback
  // must be HTTPS.
  const base = (process.env.RAZORPAY_API_BASE || "https://api.razorpay.com/v1").replace(/\/+$/, "");
  const url = new URL(base);
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (url.protocol !== "https:" && !loopback) throw new Error("RAZORPAY_API_BASE must use HTTPS");
  return base;
}

export class RazorpayApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retryable: boolean
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function attempt<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      method,
      headers: {
        authorization: `Basic ${Buffer.from(`${razorpayKeyId()}:${razorpayKeySecret()}`).toString("base64")}`,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    throw new RazorpayApiError(
      `Razorpay ${method} ${routeName(path)} ${name === "TimeoutError" ? "timed out" : "network error"}`,
      null,
      true
    );
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    // fall through to the status check
  }
  if (!res.ok) {
    const desc = (json as { error?: { description?: string } } | null)?.error?.description ?? `HTTP ${res.status}`;
    throw new RazorpayApiError(
      `Razorpay ${method} ${routeName(path)} failed: ${String(desc).slice(0, 200)}`,
      res.status,
      res.status === 429 || res.status >= 500
    );
  }
  return json as T;
}

/** "/payments/pay_abc" -> "/payments/:id", so ids never reach a log line. */
function routeName(path: string): string {
  return path.split("?")[0]!.replace(/\/(pay|order|plink)_[A-Za-z0-9]+/g, "/:id");
}

/**
 * Retries network errors, timeouts, 429 and 5xx with a short backoff. Safe for
 * creates too: a duplicate unpaid order or link that we never stored can't be
 * paid, because the buyer only ever sees the one we saved.
 */
async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  let last: unknown;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      return await attempt<T>(method, path, body);
    } catch (err) {
      last = err;
      if (!(err instanceof RazorpayApiError) || !err.retryable || i === MAX_ATTEMPTS - 1) break;
      await sleep(300 * 3 ** i);
    }
  }
  throw last;
}

// ---------------------------------------------------------------------------
// Entities (only the fields we read)
// ---------------------------------------------------------------------------

export interface RzpOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string | null;
  status: string;
}

export interface RzpPayment {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  /** created | authorized | captured | refunded | failed */
  status: string;
}

export interface RzpPaymentLink {
  id: string;
  short_url: string;
  amount: number;
  currency: string;
  reference_id: string;
  /** created | partially_paid | paid | expired | cancelled */
  status: string;
}

const ID_RE = { pay: /^pay_[A-Za-z0-9]{6,40}$/, order: /^order_[A-Za-z0-9]{6,40}$/, plink: /^plink_[A-Za-z0-9]{6,40}$/ };

export function isPaymentId(v: unknown): v is string {
  return typeof v === "string" && ID_RE.pay.test(v);
}
export function isOrderId(v: unknown): v is string {
  return typeof v === "string" && ID_RE.order.test(v);
}
export function isPaymentLinkId(v: unknown): v is string {
  return typeof v === "string" && ID_RE.plink.test(v);
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function createOrder(req: {
  amount: number;
  receipt: string;
  notes: Record<string, string>;
}): Promise<RzpOrder> {
  const order = await call<RzpOrder>("POST", "/orders", {
    amount: req.amount,
    currency: "INR",
    receipt: req.receipt,
    notes: req.notes,
  });
  if (!order || !isOrderId(order.id) || order.amount !== req.amount || order.currency !== "INR") {
    throw new RazorpayApiError("Razorpay returned an unexpected order", null, false);
  }
  return order;
}

export async function fetchPayment(paymentId: string): Promise<RzpPayment> {
  if (!isPaymentId(paymentId)) throw new RazorpayApiError("invalid payment id", null, false);
  const p = await call<RzpPayment>("GET", `/payments/${paymentId}`);
  if (!p || p.id !== paymentId) throw new RazorpayApiError("Razorpay returned an unexpected payment", null, false);
  return p;
}

export async function createPaymentLink(req: {
  amount: number;
  referenceId: string;
  description: string;
  expireBy: Date;
  notes: Record<string, string>;
  /**
   * Name shown on Razorpay's hosted payment-link page and checkout instead of
   * the account's registered business name (options.checkout.name). Display only:
   * amount, reference and settlement are unaffected.
   */
  checkoutName?: string;
}): Promise<RzpPaymentLink> {
  const checkoutName = req.checkoutName?.trim().slice(0, 60);
  const link = await call<RzpPaymentLink>("POST", "/payment_links", {
    amount: req.amount,
    currency: "INR",
    accept_partial: false,
    reference_id: req.referenceId,
    description: req.description,
    expire_by: Math.floor(req.expireBy.getTime() / 1000),
    // No customer block: nothing personal is prefilled or stored, and Razorpay
    // sends no SMS/email on our behalf.
    notify: { sms: false, email: false },
    reminder_enable: false,
    notes: req.notes,
    ...(checkoutName ? { options: { checkout: { name: checkoutName } } } : {}),
  });
  if (!link || !isPaymentLinkId(link.id) || link.amount !== req.amount || link.reference_id !== req.referenceId) {
    throw new RazorpayApiError("Razorpay returned an unexpected payment link", null, false);
  }
  const url = new URL(link.short_url);
  if (url.protocol !== "https:" || !/(^|\.)(rzp\.io|razorpay\.com)$/.test(url.hostname)) {
    // Only ever send a buyer to Razorpay's own hosted page.
    throw new RazorpayApiError("Razorpay payment link is not on a Razorpay domain", null, false);
  }
  return link;
}

// ---------------------------------------------------------------------------
// Signatures
// ---------------------------------------------------------------------------

function hmacHex(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

function safeEqualHex(expectedHex: string, given: string | null | undefined): boolean {
  if (typeof given !== "string" || !/^[0-9a-f]{64}$/i.test(given)) return false;
  const a = Buffer.from(expectedHex, "hex");
  const b = Buffer.from(given.toLowerCase(), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Checkout callback: HMAC-SHA256(order_id + "|" + payment_id, key secret). */
export function verifyCheckoutSignature(
  orderId: string,
  paymentId: string,
  signature: string | null | undefined,
  secret: string = razorpayKeySecret()
): boolean {
  if (!secret || !isOrderId(orderId) || !isPaymentId(paymentId)) return false;
  return safeEqualHex(hmacHex(secret, `${orderId}|${paymentId}`), signature);
}

/** Webhook: HMAC-SHA256 of the raw request body, webhook secret. */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string = razorpayWebhookSecret()
): boolean {
  if (!secret) return false;
  return safeEqualHex(hmacHex(secret, rawBody), signature);
}

/** "pay_ABCDEFGHIJ" -> "pay_…GHIJ" for log lines. */
export function maskId(id: string | null | undefined): string {
  if (!id) return "-";
  const us = id.indexOf("_");
  const prefix = us > 0 && us < 8 ? id.slice(0, us + 1) : "";
  return `${prefix}…${id.slice(-4)}`;
}
