// Premium purchase path, end to end, against mock gateways:
//  - Razorpay (UPI/card): plan page → checkout → Razorpay window (stand-in) →
//    server verifies the signature and the payment → Premium active → webhook
//    arrives as well and must not add a second period
//  - NOWPayments (crypto): coin list rules → invoice → signed IPN → Premium
//  - what must never activate Premium: bad signatures, a wrong amount
//  - the fixed ₹100 = $1 rate and the no-refund wording
//
// The real gateway SDK and APIs are never contacted.
import path from "node:path";
import { MOCK, OUT, check, engineNames, externalTarget, finish, launch, newDevice, nowpaymentsIpn, prisma, q, razorpayCheckoutSignature, razorpayWebhook, resetTestData, seen, sessionFor, shot, x } from "./lib.mjs";

const SHOTS = path.join(OUT, "screens", "premium-purchase");
const NO_REFUND = "Digital product. All sales are final. No refunds.";
/** The notice, as actually shown on screen (not merely present in the markup). */
const noRefundShown = (page) => seen(page.locator(`:text("${NO_REFUND}"):visible`));

await resetTestData();
await x(`delete from razorpay_webhook_events where "eventId" like 'evt_e2e_%'`).catch(() => {});

/** Stand-in for Razorpay's checkout.js: "pays" at once through the test hook. */
const RAZORPAY_STUB = `window.Razorpay=function(o){this.o=o};
window.Razorpay.prototype.on=function(){};
window.Razorpay.prototype.open=function(){var o=this.o;window.__e2eOpened=(window.__e2eOpened||0)+1;window.__e2eOptions={key:o.key,amount:o.amount,currency:o.currency,order_id:o.order_id,name:o.name,prefill:o.prefill||null};
  window.__e2ePay(o.order_id,o.amount,o.currency).then(function(r){o.handler({razorpay_order_id:o.order_id,razorpay_payment_id:r.paymentId,razorpay_signature:r.signature})});};`;

let payN = 0;
async function buyer(n) {
  const id = `e2ebuyer${String(n).padStart(18, "0")}`;
  const email = `e2e-buyer${n}@test.local`;
  await x(`insert into users (id, email, name, role, "emailVerified", "createdAt", "updatedAt") values ($1,$2,'E2E Buyer','USER',now(),now(),now())`, id, email);
  return { id, email, session: await sessionFor(id, email) };
}
const premiumUntil = async (id) => (await q(`select "premiumUntil" from users where id=$1`, id))[0]?.premiumUntil ?? null;
const days = (d) => (d ? (new Date(d).getTime() - Date.now()) / 86_400_000 : 0);

async function razorpayPurchase(engine, browser, n, plan, device) {
  const tag = `${engine} razorpay ${plan.toLowerCase()}`;
  const u = await buyer(n);
  const ctx = await newDevice(browser, engine, device, { ip: `10.70.0.${n}`, session: u.session });
  ctx.razorpayStub = RAZORPAY_STUB;
  const page = await ctx.newPage();
  // "Pays": registers a captured payment at the mock gateway for exactly what
  // the checkout asked, and signs it the way Razorpay does.
  let paid = null;
  await page.exposeFunction("__e2ePay", async (orderId, amount, currency) => {
    const paymentId = `pay_E2E${String(Date.now()).slice(-7)}${++payN}`;
    await fetch(`${MOCK}/rzp/__payment`, { method: "POST", body: JSON.stringify({ id: paymentId, order_id: orderId, amount, currency, status: "captured" }) });
    paid = { orderId, paymentId, amount, currency };
    return { paymentId, signature: razorpayCheckoutSignature(orderId, paymentId) };
  });

  await page.goto("/premium");
  check(`${tag}: plan page shows ₹100 and ₹1,000 (₹100 = $1)`, (await page.getByText("₹100").first().isVisible()) && (await page.getByText("₹1,000").first().isVisible()));
  check(`${tag}: plan page shows the no-refund notice`, await noRefundShown(page));
  if (n === 1) await shot(page, path.join(SHOTS, engine), "1-premium-page", true);

  await page.goto(`/premium/checkout?plan=${plan}`);
  await page.getByRole("tab", { name: /UPI \/ Card/ }).waitFor({ timeout: 15_000 });
  const price = plan === "MONTHLY" ? "₹100" : "₹1,000";
  check(`${tag}: checkout shows ${price}`, await page.getByText(price).first().isVisible());
  check(`${tag}: checkout shows the no-refund notice before paying`, await noRefundShown(page));
  const payBtn = page.getByRole("button", { name: /Accept the Terms to continue|with UPI \/ Card/ });
  check(`${tag}: Pay is disabled until the terms are accepted`, await payBtn.isDisabled());
  await page.locator('input[type="checkbox"]').first().check();
  if (n === 1) await shot(page, path.join(SHOTS, engine), "2-checkout", true);
  await page.getByRole("button", { name: new RegExp(`Pay ${price.replace("₹", "₹")} with UPI / Card`) }).click();
  await page.waitForURL(/\/premium\/success\?rzp=/, { timeout: 30_000 }).catch(() => {});
  check(`${tag}: after paying, lands on the success page`, /\/premium\/success\?rzp=/.test(page.url()), page.url());
  const opts = await page.evaluate(() => window.__e2eOptions).catch(() => null);
  if (n === 1) await shot(page, path.join(SHOTS, engine), "3-success", true);

  const expectPaise = plan === "MONTHLY" ? 10_000 : 100_000;
  check(`${tag}: amount sent to Razorpay is ${expectPaise} paise in INR`, paid?.amount === expectPaise && paid?.currency === "INR", JSON.stringify(paid));
  check(`${tag}: nothing personal was prefilled in the Razorpay window`, !opts?.prefill || Object.values(opts.prefill).every((v) => !v), JSON.stringify(opts?.prefill));
  const row = (await q(`select status::text, amount, "fulfilledAt", "paymentId" from razorpay_payments where "userId"=$1`, u.id))[0];
  check(`${tag}: payment row is PAID for ${expectPaise} paise`, row?.status === "PAID" && row?.amount === expectPaise && row?.fulfilledAt, JSON.stringify(row));
  const until = await premiumUntil(u.id);
  const want = plan === "MONTHLY" ? [29, 32] : [364, 367];
  check(`${tag}: Premium is active for the plan's period`, days(until) > want[0] && days(until) < want[1], `${days(until).toFixed(1)} days`);
  check(`${tag}: success page confirms Premium`, await seen(page.locator("main").getByText(/Premium/i)));

  // The gateway's own webhook for the same payment must be accepted and change nothing.
  const hook = await razorpayWebhook("payment.captured", { payment: { entity: { id: paid.paymentId, order_id: paid.orderId } } }, `evt_e2e_${engine}_${n}`);
  check(`${tag}: webhook for the same payment is accepted (200)`, hook.status === 200, hook.status);
  const subs = (await q(`select count(*)::int n from subscriptions where "userId"=$1`, u.id))[0].n;
  check(`${tag}: still exactly one subscription period (no double credit)`, subs === 1, subs);
  check(`${tag}: Premium end date unchanged by the webhook`, String(await premiumUntil(u.id)) === String(until));

  // As a member, a download skips the gate.
  const course = (await q(`select slug, "downloadUrl" from courses where published and not premium and "downloadUrl" is not null limit 1`))[0];
  await page.goto(`/download/${course.slug}`);
  const target = await externalTarget(page).catch(() => page.url());
  check(`${tag}: new member's download goes straight to the file`, target === course.downloadUrl || new URL(target).href === new URL(course.downloadUrl).href, target);
  check(`${tag}: no browser errors`, ctx.errors.length === 0, ctx.errors.join(" | "));
  await ctx.close();
  return u;
}

async function razorpayRefusals() {
  const u = await buyer(50);
  // A forged webhook signature must be rejected outright.
  const raw = JSON.stringify({ entity: "event", event: "payment.captured", payload: { payment: { entity: { id: "pay_E2EFORGED001", order_id: "order_NOPE0000001" } } } });
  const forged = await fetch(`${process.env.E2E_BASE}/api/payments/razorpay/webhook`, { method: "POST", headers: { "content-type": "application/json", "x-razorpay-signature": "0".repeat(64), "x-razorpay-event-id": "evt_e2e_forged" }, body: raw });
  check("razorpay: webhook with a forged signature is rejected", forged.status === 400 || forged.status === 401, forged.status);
  // A correctly signed webhook for an order we never created does nothing.
  const unknown = await razorpayWebhook("payment.captured", { payment: { entity: { id: "pay_E2EUNKNOWN01", order_id: "order_NOPE0000002" } } }, "evt_e2e_unknown");
  check("razorpay: signed webhook for an unknown order is ignored", unknown.status === 200 && !(await premiumUntil(u.id)), unknown.status);
}

async function cryptoPurchase(browser) {
  const tag = "nowpayments";
  const u = await buyer(60);
  const ctx = await newDevice(browser, "chromium", "phone-large", { ip: "10.70.0.60", session: u.session });
  const page = await ctx.newPage();
  await page.goto("/premium/checkout?plan=MONTHLY");
  await page.getByRole("tab", { name: /Crypto/ }).click();
  const coins = page.locator('[aria-label="Popular coins"]');
  await coins.waitFor({ timeout: 20_000 });
  const listed = (await coins.textContent()) ?? "";
  check(`${tag}: coins that fit the $1 plan are listed (USDT, Litecoin)`, /USDT/.test(listed) && /Litecoin|LTC/.test(listed), listed.slice(0, 200));
  check(`${tag}: coins whose minimum is above $1 are hidden, not greyed (no Bitcoin)`, !/Bitcoin|BTC/.test(listed), listed.slice(0, 300));
  check(`${tag}: checkout shows the no-refund notice`, await noRefundShown(page));
  await shot(page, path.join(SHOTS, "chromium"), "4-crypto-checkout", true);
  await coins.locator("button").first().click();
  const agree = page.locator('input[type="checkbox"]');
  if (await agree.count()) await agree.first().check().catch(() => {});
  await page.getByRole("button", { name: /^Pay \$1 with/ }).click();
  const invoice = await externalTarget(page, 30_000).catch(() => null);
  check(`${tag}: buyer is sent to the hosted invoice page`, Boolean(invoice?.startsWith("https://nowpayments.io/payment/")), invoice ?? page.url());

  const pay = (await q(`select "orderId", "invoiceId", status::text, "priceAmount"::float8 usd, "payCurrency" from payments where "userId"=$1`, u.id))[0];
  check(`${tag}: payment row created for $1, waiting`, pay?.usd === 1 && ["WAITING", "PENDING"].includes(pay?.status), JSON.stringify(pay));
  check(`${tag}: no Premium before the payment settles`, !(await premiumUntil(u.id)));

  const base = { payment_id: 7770001, invoice_id: Number(pay.invoiceId), order_id: pay.orderId, price_amount: 1, price_currency: "usd", pay_amount: 1.01, pay_currency: pay.payCurrency, actually_paid: 1.01 };
  let r = await nowpaymentsIpn({ ...base, payment_status: "finished" }, "f".repeat(128));
  check(`${tag}: IPN with a forged signature is rejected (401)`, r.status === 401, r.status);
  check(`${tag}: …and Premium is still off`, !(await premiumUntil(u.id)));
  r = await nowpaymentsIpn({ ...base, payment_status: "finished", price_amount: 0.01 });
  check(`${tag}: signed IPN with a tampered price does not activate`, !(await premiumUntil(u.id)), r.status);
  r = await nowpaymentsIpn({ ...base, payment_status: "confirming" });
  check(`${tag}: "confirming" does not activate`, r.status === 200 && !(await premiumUntil(u.id)), r.status);
  r = await nowpaymentsIpn({ ...base, payment_status: "finished" });
  const until = await premiumUntil(u.id);
  check(`${tag}: signed "finished" IPN activates Premium for a month`, r.status === 200 && days(until) > 29 && days(until) < 32, `${r.status} ${days(until).toFixed(1)} days`);
  r = await nowpaymentsIpn({ ...base, payment_status: "finished" });
  const subs = (await q(`select count(*)::int n from subscriptions where "userId"=$1`, u.id))[0].n;
  check(`${tag}: a repeated IPN adds nothing (one period)`, r.status === 200 && subs === 1 && String(await premiumUntil(u.id)) === String(until), subs);

  await page.goto(`/premium/success?order=${encodeURIComponent(pay.orderId)}`);
  check(`${tag}: success page confirms Premium`, await seen(page.locator("main").getByText(/Premium/i)));
  await shot(page, path.join(SHOTS, "chromium"), "5-crypto-success", true);
  check(`${tag}: no browser errors`, ctx.errors.length === 0, ctx.errors.join(" | "));
  await ctx.close();
}

async function signedOutCheckout(browser) {
  const ctx = await newDevice(browser, "chromium", "phone-large", { ip: "10.70.0.90" });
  const page = await ctx.newPage();
  await page.goto("/premium/checkout?plan=MONTHLY");
  check("checkout without an account asks to sign in first (payments need an account)", /\/login/.test(page.url()), page.url());
  await page.goto("/premium");
  check("premium page is readable without an account", await page.getByRole("heading", { level: 1 }).isVisible());
  await ctx.close();
}

const engines = engineNames();
let n = 0;
for (const engine of engines) {
  const browser = await launch(engine);
  await razorpayPurchase(engine, browser, ++n, "MONTHLY", "phone-large").catch((e) => check(`${engine}: Razorpay monthly purchase ran to the end`, false, e.stack));
  if (engine === "chromium") {
    await razorpayPurchase(engine, browser, ++n, "YEARLY", "laptop").catch((e) => check(`${engine}: Razorpay yearly purchase ran to the end`, false, e.stack));
    await cryptoPurchase(browser).catch((e) => check("NOWPayments purchase ran to the end", false, e.stack));
    await signedOutCheckout(browser).catch((e) => check("signed-out checkout check ran", false, e.stack));
  }
  await browser.close();
}
await razorpayRefusals().catch((e) => check("Razorpay refusal checks ran", false, e.stack));

await prisma.$disconnect();
process.exit(finish("payments") ? 1 : 0);
