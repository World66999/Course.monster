// Shared helpers for the browser tests. Everything talks to the test site and
// the throwaway database from tests/e2e/env.sh; nothing here knows about the
// live site.
import { chromium, firefox, webkit } from "playwright";
import { createRequire } from "node:module";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "../..");

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`${name} is not set. Run the tests through tests/e2e/run.sh (it sources env.sh).`);
    process.exit(2);
  }
  return v;
}

export const BASE = need("E2E_BASE");
export const MOCK = need("E2E_MOCK");
const DB_URL = need("E2E_DATABASE_URL");
const AUTH_SECRET = need("AUTH_SECRET");
export const OUT = process.env.E2E_OUT ?? "/tmp/coursevault-e2e-run/results";
fs.mkdirSync(OUT, { recursive: true });

// The project's own Prisma client and Auth.js cookie encoder.
const requireFromRoot = createRequire(path.join(ROOT, "package.json"));
const { PrismaClient } = requireFromRoot("@prisma/client");
export const prisma = new PrismaClient({ datasourceUrl: DB_URL });
export const q = (sql, ...p) => prisma.$queryRawUnsafe(sql, ...p);
export const x = (sql, ...p) => prisma.$executeRawUnsafe(sql, ...p);
const { encode } = await import(path.join(ROOT, "node_modules/next-auth/jwt.js"));
const bcrypt = requireFromRoot("bcryptjs");

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** True once the element is visible, waiting up to `ms` (plain isVisible() does not wait). */
export const seen = (locator, ms = 10_000) => locator.first().waitFor({ state: "visible", timeout: ms }).then(() => true, () => false);

/** Waits until React has attached to this element, so typing into it is not lost to hydration. */
export const reactReady = (locator) =>
  locator.first().evaluate((el) => new Promise((resolve) => {
    const ok = () => Object.keys(el).some((k) => k.startsWith("__reactProps") || k.startsWith("__reactFiber"));
    const tick = (n) => (ok() || n > 100 ? setTimeout(resolve, 150) : setTimeout(() => tick(n + 1), 100));
    tick(0);
  }));

/** Waits until the page's scripts have taken over (the theme button is disabled until then). */
export const hydrated = (page) => page.locator('button[aria-label^="Switch to"]').first().waitFor({ timeout: 20_000 }).catch(() => {});
export const ADMIN_SEGMENT = fs.readdirSync(path.join(ROOT, "src/app")).find((d) => /^[A-Za-z0-9]{40,}$/.test(d));
export const ADMIN = `/${ADMIN_SEGMENT}`;
/** Keeps the secret admin path out of reports. */
export const redact = (s) => String(s).split(ADMIN_SEGMENT).join("<admin>");

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
export const results = [];
export function check(name, cond, extra = "") {
  const ok = Boolean(cond);
  results.push({ name: redact(name), ok, extra: ok ? "" : redact(String(extra)).slice(0, 400) });
  if (!ok || process.env.E2E_VERBOSE) console.log(`  ${ok ? "✔" : "✘"} ${redact(name)}${ok ? "" : ` — ${redact(String(extra)).slice(0, 400)}`}`);
}
/** Something worth telling the reader that is not a failure of this build. */
export const notes = [];
export function note(text) {
  notes.push(redact(text));
  console.log(`  NOTE: ${redact(text)}`);
}

export function finish(suite) {
  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(path.join(OUT, `${suite}.json`), JSON.stringify({ suite, passed: results.length - failed.length, failed: failed.length, notes, results }, null, 2));
  console.log(`\n${suite.toUpperCase()}: ${results.length - failed.length} passed, ${failed.length} failed`);
  for (const f of failed) console.log(`  FAILED: ${f.name} — ${f.extra}`);
  return failed.length;
}

// ---------------------------------------------------------------------------
// Browsers and devices
// ---------------------------------------------------------------------------
export const ENGINES = { chromium, firefox, webkit };
export function engineNames() {
  const only = process.env.E2E_BROWSERS?.split(",").map((s) => s.trim()).filter(Boolean);
  return only?.length ? only : Object.keys(ENGINES);
}
export const launch = (name) => ENGINES[name].launch();

const UA = {
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  telegramAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.107 Mobile Safari/537.36 Telegram-Android/11.4.2 (Samsung SM-S918B; Android 14; SDK 34; HIGH)",
  desktop: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
};

/** name → viewport. Firefox has no mobile emulation flag, so `mobile` only sets size + touch there. */
export const DEVICES = {
  "phone-small": { width: 320, height: 568, mobile: true, ua: UA.android },
  "phone-large": { width: 430, height: 932, mobile: true, ua: UA.iphone },
  "phone-landscape": { width: 844, height: 390, mobile: true, ua: UA.iphone },
  "telegram-android": { width: 390, height: 780, mobile: true, ua: UA.telegramAndroid },
  "tablet-portrait": { width: 820, height: 1180, mobile: true, ua: UA.iphone },
  "tablet-landscape": { width: 1180, height: 820, mobile: true, ua: UA.iphone },
  laptop: { width: 1366, height: 768, mobile: false, ua: UA.desktop },
  "desktop-wide": { width: 2560, height: 1440, mobile: false, ua: UA.desktop },
  "tv-4k": { width: 3840, height: 2160, mobile: false, ua: UA.desktop },
};

const TURNSTILE_STUB = `(function(){
  var src=(document.currentScript&&document.currentScript.src)||"";var m=src.match(/onload=([^&]+)/);
  window.turnstile={render:function(el,o){var box=typeof el==="string"?document.querySelector(el):el;
    if(box){box.innerHTML='<div style="width:300px;max-width:100%;height:65px;border:1px solid #888;border-radius:6px;display:flex;align-items:center;justify-content:center;font:14px sans-serif">Captcha (test stand-in)</div>';}
    setTimeout(function(){o&&o.callback&&o.callback("XXXX.DUMMY.TOKEN")},300);return "ts1";},
    reset:function(){},remove:function(){},getResponse:function(){return "XXXX.DUMMY.TOKEN"},isExpired:function(){return false},execute:function(){},ready:function(cb){cb&&cb()}};
  if(m&&typeof window[m[1]]==="function")window[m[1]]();
})();`;

const local = (u) => u.host.startsWith("127.0.0.1");
/**
 * What Firefox and WebKit report when a test leaves a page while a background
 * request (the session check, a link prefetch, a lazy script) is still in
 * flight. The browser simply cancels it. A request that truly fails is caught
 * separately by the sweep's failed-request and HTTP-status checks.
 */
const NAVIGATION_NOISE = /Failed to fetch RSC payload|NetworkError when attempting to fetch|Load failed|AbortError|due to access control checks|_getSession@|Failed to load chunk|\/turbopack-[a-z0-9]+\.js/;
const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

/**
 * A browser context standing in for one visitor on one device.
 * - Outside pages are never loaded: page navigations off-site are recorded in
 *   `ctx.externalNavs` and answered with a stub.
 * - The site's own redirect endpoints (/go, /unlock, /dl) are followed by hand
 *   so an off-site redirect is recorded the same way.
 * - Console errors and failed requests are collected in `ctx.errors`.
 */
export async function newDevice(browser, engine, deviceName, { ip = "10.50.0.1", scheme = "dark", reducedMotion = false, session = null, storedTheme = null } = {}) {
  const d = DEVICES[deviceName];
  const ctx = await browser.newContext({
    viewport: { width: d.width, height: d.height },
    userAgent: d.ua,
    hasTouch: d.mobile,
    ...(engine !== "firefox" && d.mobile ? { isMobile: true } : {}),
    deviceScaleFactor: d.mobile ? 2 : 1,
    colorScheme: scheme,
    reducedMotion: reducedMotion ? "reduce" : "no-preference",
    baseURL: BASE,
    extraHTTPHeaders: { "cf-connecting-ip": ip },
    serviceWorkers: "block",
  });
  // The site's default is dark; an explicit choice is what a returning visitor has.
  await ctx.addInitScript((t) => {
    try {
      if (t) localStorage.setItem("theme", t);
    } catch {}
  }, storedTheme ?? scheme);
  ctx.externalNavs = [];
  ctx.errors = [];
  await ctx.route(
    (u) => !local(u),
    async (route) => {
      const r = route.request();
      const u = new URL(r.url());
      if (u.host === "challenges.cloudflare.com") return route.fulfill({ status: 200, contentType: "application/javascript", body: TURNSTILE_STUB });
      if (u.host === "checkout.razorpay.com") return route.fulfill({ status: 200, contentType: "application/javascript", body: ctx.razorpayStub ?? "" });
      if (r.resourceType() === "document") {
        ctx.externalNavs.push(r.url());
        return route.fulfill({ status: 200, contentType: "text/html", body: `<title>left site</title><p id="ext" data-href="${r.url().replace(/"/g, "&quot;")}">external</p>` });
      }
      // Anything else off-site is answered locally, never fetched: a 1x1 image
      // for pictures (YouTube thumbnails, avatars), nothing for the rest.
      if (r.resourceType() === "image") return route.fulfill({ status: 200, contentType: "image/png", body: PIXEL });
      return route.fulfill({ status: 204, body: "" });
    }
  );
  const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  await ctx.route(
    (u) => local(u) && /^\/(go|unlock|dl)\//.test(u.pathname),
    async (route) => {
      const resp = await route.fetch({ maxRedirects: 0 });
      const loc = resp.headers()["location"];
      if (resp.status() >= 300 && resp.status() < 400 && loc && !new URL(loc, BASE).host.startsWith("127.0.0.1")) {
        ctx.externalNavs.push(loc);
        return route.fulfill({ status: 200, contentType: "text/html", body: `<title>left site</title><p id="ext" data-href="${esc(loc)}">Left the site</p>` });
      }
      return route.fulfill({ response: resp });
    }
  );
  ctx.on("page", (p) => {
    p.on("console", async (m) => {
      if (m.type() !== "error" || !p.url().startsWith(BASE)) return;
      let text = m.text();
      // Next.js logs this when a test navigates away while a link prefetch is
      // still in flight; the browser just loads the page normally instead.
      if (/Failed to fetch RSC payload/.test(text)) return;
      if (ctx.ignoreErrors?.some((re) => re.test(text))) return;
      // Firefox prints a bare "Error" for thrown objects: fetch the real message.
      if (/^(Error|JSHandle@\w+)$/.test(text.trim())) {
        const detail = await Promise.all(m.args().map((a) => a.evaluate((v) => (v && (v.stack || v.message)) || String(v)).catch(() => ""))).catch(() => []);
        if (detail.join(" ").trim()) text = detail.join(" ").slice(0, 400);
        // Still nothing but the word "Error": the page it came from is already
        // gone (the test moved on mid-request). Uncaught exceptions are
        // reported separately through `pageerror`, so nothing real is lost.
        else return;
      }
      if (NAVIGATION_NOISE.test(text)) return;
      ctx.errors.push(`${redact(p.url().replace(BASE, ""))} :: ${text}`);
    });
    p.on("pageerror", (e) => {
      if (NAVIGATION_NOISE.test(e.message)) return;
      ctx.errors.push(`${redact(p.url().replace(BASE, ""))} :: pageerror ${e.message}`);
    });
  });
  if (session) await ctx.addCookies([{ name: "authjs.session-token", value: session, url: BASE, httpOnly: true }]);
  return ctx;
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------
export const sessionFor = (id, email, role = "USER") =>
  encode({ token: { sub: id, id, role, email, name: "e2e" }, secret: AUTH_SECRET, salt: "authjs.session-token" });

export const ADMIN_USER = { id: "e2eadminuser00000000000001", email: "e2e-admin@test.local", password: "E2e-Admin-Pass-2026!" };

/** Removes everything earlier runs created, then recreates the test accounts. */
export async function resetTestData() {
  await x(`delete from free_unlock_quotas`);
  await x(`delete from free_unlocks`);
  await x(`delete from free_unlock_sessions`);
  await x(`delete from courses where slug like 'e2e-%'`);
  await x(`delete from users where email like 'e2e-%@test.local'`);
  const hash = await bcrypt.hash(ADMIN_USER.password, 10);
  await x(
    `insert into users (id, email, name, role, "passwordHash", "emailVerified", "createdAt", "updatedAt") values ($1,$2,'E2E Admin','ADMIN',$3,now(),now(),now())`,
    ADMIN_USER.id,
    ADMIN_USER.email,
    hash
  );
  await x(`insert into users (id, email, name, role, "emailVerified", "createdAt", "updatedAt") values ('e2efreeuser000000000000001','e2e-free@test.local','E2E Free','USER',now(),now(),now())`);
  await x(`insert into users (id, email, name, role, "emailVerified", "premiumUntil", "createdAt", "updatedAt") values ('e2epremuser000000000000001','e2e-prem@test.local','E2E Premium','USER',now(),now()+interval '30 days',now(),now())`);
}

// ---------------------------------------------------------------------------
// Download gate
// ---------------------------------------------------------------------------
/** Solves whichever human-check mini game the gate shows. */
export async function solveChallenge(page, ch) {
  if (ch.type === "sequence") {
    await page.locator('[aria-label="Tile 1"]').waitFor({ timeout: 15_000 });
    await sleep(ch.params.sequence.length * 800 + 900);
    for (const t of ch.params.sequence) {
      await page.locator(`[aria-label="Tile ${t + 1}"]`).click();
      await sleep(260);
    }
    return;
  }
  const s = page.getByRole("slider");
  await s.waitFor({ timeout: 15_000 });
  await sleep(300);
  await s.focus();
  for (let i = 0; i < 400; i++) {
    const v = Number(await s.getAttribute("aria-valuenow"));
    let diff = ch.params.target - v;
    if (ch.type === "dial") diff = ((diff + 540) % 360) - 180;
    if (Math.abs(diff) <= Math.max(0, ch.params.tolerance - 2)) break;
    await page.keyboard.press(diff > 0 ? "ArrowRight" : "ArrowLeft");
    await sleep(25);
  }
  await sleep(900); // hold to confirm
}

/** On /download/<slug>: wait out the countdown, press the button, pass the human check. */
export async function passGate(page, attempt = 0) {
  const chResp = page.waitForResponse((r) => r.url().includes("/api/verify/challenge") && r.request().method() === "GET", { timeout: 30_000 });
  chResp.catch(() => {});
  const btn = page.getByRole("button", { name: /Get download link/ });
  await btn.waitFor({ timeout: 20_000 });
  await page.waitForFunction(
    () => {
      const b = [...document.querySelectorAll("button")].find((el) => /Get download link/.test(el.textContent ?? ""));
      return b && !b.disabled;
    },
    null,
    { timeout: 25_000 }
  );
  const initResp = page.waitForResponse((r) => r.url().endsWith("/api/download/init"), { timeout: 60_000 });
  initResp.catch(() => {});
  await btn.click();
  try {
    await solveChallenge(page, await (await chResp).json());
    const ir = await initResp;
    return { status: ir.status(), at: Date.now() };
  } catch (err) {
    if (attempt >= 2) throw err;
    await page.reload();
    return passGate(page, attempt + 1);
  }
}

export const progressOf = async (page) => {
  const t = await page.locator("[data-free-progress]").first().textContent({ timeout: 4000 }).catch(() => null);
  return t?.match(/Free courses today: (\d+)\/(\d+) used/)?.slice(1).join("/") ?? null;
};

/** Where the site's /go, /unlock or /dl redirect sent the visitor off-site. */
export async function externalTarget(page, timeout = 30_000) {
  const el = page.locator("#ext");
  await el.waitFor({ timeout });
  return el.getAttribute("data-href");
}

export async function shot(page, dir, name, fullPage = false) {
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage, animations: "disabled" }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Signing (same algorithms the gateways use, with the test secrets)
// ---------------------------------------------------------------------------
export const hmac = (algo, secret, data) => createHmac(algo, secret).update(data).digest("hex");
const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);

export function razorpayWebhook(event, payload, eventId) {
  const raw = JSON.stringify({ entity: "event", event, payload });
  return fetch(`${BASE}/api/payments/razorpay/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": hmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET, raw),
      "x-razorpay-event-id": eventId,
      "cf-connecting-ip": "10.60.0.1",
    },
    body: raw,
  });
}
export const razorpayCheckoutSignature = (orderId, paymentId) => hmac("sha256", process.env.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`);

export function nowpaymentsIpn(payload, signature) {
  const sig = signature ?? hmac("sha512", process.env.NOWPAYMENTS_IPN_SECRET, JSON.stringify(sortKeys(payload)));
  return fetch(`${BASE}/api/payments/nowpayments/ipn`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-nowpayments-sig": sig, "cf-connecting-ip": "10.60.0.2" },
    body: JSON.stringify(payload),
  });
}

export const mockLog = async () => (await fetch(`${MOCK}/__log`)).json();
export const clearMockLog = () => fetch(`${MOCK}/__log`, { method: "DELETE" });
