// Page sweep: every page, in every browser engine, across the device matrix.
// For each visit: HTTP status, console errors, failed requests, broken images,
// sideways scrolling, content left hidden by animations, and on phones the
// input font size (iOS zooms below 16px) and tap-target size.
//
//   node sweep.mjs            all engines, one after another
//   E2E_BROWSERS=webkit node sweep.mjs
import path from "node:path";
import { ADMIN, ADMIN_USER, BASE, OUT, check, engineNames, finish, launch, newDevice, prisma, q, redact, resetTestData, sessionFor, shot } from "./lib.mjs";

const SHOTS = path.join(OUT, "screens");

// Engines can be swept side by side as separate processes; only the first one
// may reset the shared test accounts (E2E_NO_RESET=1 for the others).
if (!process.env.E2E_NO_RESET) await resetTestData();
const course = (await q(`select slug from courses where published and not premium order by downloads desc limit 1`))[0];
const fresh = (await q(`select slug from courses where published and not premium order by "createdAt" asc limit 1`))[0];
const premiumCourse = (await q(`select slug from courses where published and premium limit 1`))[0];
const app = (await q(`select slug from apps where published limit 1`).catch(() => []))[0];
const learn = (await q(`select slug from learning_resources where published limit 1`).catch(() => []))[0];
const channel = (await q(`select slug from coding_channels where published limit 1`).catch(() => []))[0];

const PUBLIC = [
  ["home", "/"],
  ["courses", "/courses"],
  ["courses-search", "/courses?q=python&sort=popular"],
  ["course", `/courses/${course.slug}`],
  ["download", `/download/${fresh.slug}`],
  ...(premiumCourse ? [["download-premium-locked", `/download/${premiumCourse.slug}`]] : []),
  ["premium", "/premium"],
  ["saved", "/saved"],
  ["login", "/login"],
  ["signup", "/signup"],
  ["forgot-password", "/forgot-password"],
  ["apps", "/apps"],
  ...(app ? [["app", `/apps/${app.slug}`]] : []),
  ["free-resources", "/free-resources"],
  ["ai-platforms", "/ai-platforms"],
  ["coding-channels", "/coding-channels"],
  ...(channel ? [["coding-channel", `/coding-channels/${channel.slug}`]] : []),
  ["learn", "/learn"],
  ...(learn ? [["learn-item", `/learn/${learn.slug}`]] : []),
  ["how-to-download", "/how-to-download"],
  ["downloader", "/downloader"],
  ["contact", "/contact"],
  ["premium-resources", "/premium-resources"],
  ["premium-chats", "/premium-chats"],
  ["terms", "/terms"],
  ["privacy", "/privacy"],
  ["refund-policy", "/refund-policy"],
  ["copyright", "/copyright"],
  ["not-found", "/this-page-does-not-exist"],
];
const KEY = ["home", "courses", "course", "download", "premium", "saved", "not-found"];
const SIGNED_IN = [
  ["account", "/account"],
  ["checkout", "/premium/checkout?plan=MONTHLY"],
  ["premium-support", "/premium/support"],
];
const ADMIN_PAGES = [
  "", "courses", "courses/new", "categories", "moderation", "chat", "requests", "coding-channels", "learning-resources",
  "apps", "free-resources", "ai-platforms", "users", "payments", "payments?tab=subscriptions", "premium", "razorpay",
  "premium-resources", "premium-chats", "support", "pages", "subscribers", "telegram", "telegram/users",
  "telegram/broadcasts", "telegram/logs", "telegram/appearance", "social-downloader", "activity", "settings",
].map((p) => [`admin-${p.replace(/[/?=]/g, "-") || "dashboard"}`, p ? `${ADMIN}/${p}` : ADMIN]);

const links = new Map();

async function inspect(ctx, tag, name, url, { phone = false, screenshot = false } = {}) {
  const page = await ctx.newPage();
  const errs = [];
  const bad = [];
  const expected404 = name === "not-found";
  page.on("console", (m) => {
    if (m.type() === "error" && !(expected404 && /404/.test(m.text()))) errs.push(m.text());
  });
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().startsWith(BASE) && !(expected404 && r.request().resourceType() === "document")) bad.push(`${r.status()} ${r.url().replace(BASE, "")}`);
  });
  page.on("requestfailed", (r) => {
    const why = r.failure()?.errorText ?? "";
    // Cancelled link prefetches and beacons cut off by the next navigation are normal.
    if (/ERR_ABORTED|NS_BINDING_ABORTED|cancelled|Load request cancelled|NS_ERROR_ABORT/i.test(why)) return;
    if (r.url().startsWith(BASE)) bad.push(`FAILED ${r.url().replace(BASE, "").slice(0, 100)} ${why}`);
  });
  const t0 = Date.now();
  const res = await page.goto(url, { waitUntil: "load", timeout: 60_000 }).catch((e) => (errs.push("goto: " + e.message.split("\n")[0]), null));
  const loadMs = Date.now() - t0;
  await page.waitForTimeout(700);
  // Scroll through the way a reader does (a screen at a time, letting each
  // frame paint) so lazy images load and scroll reveals fire. At every stop,
  // anything on screen that is still hidden by a reveal animation is a fault.
  const stuck = await page.evaluate(async () => {
    const pause = (ms) => new Promise((r) => requestAnimationFrame(() => setTimeout(r, ms)));
    // A reveal starts a frame or two after the element comes into view; give a
    // busy machine up to ~1 s before calling it stuck.
    const settle = async () => {
      await pause(160);
      for (let i = 0; i < 4 && hiddenInView() > 0; i++) await pause(220);
    };
    const hiddenInView = () =>
      [...document.querySelectorAll('[data-reveal="pending"],[data-stagger="pending"]')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.height > 0 && r.top < window.innerHeight * 0.8 && r.bottom > window.innerHeight * 0.1;
      }).length;
    let worst = 0;
    const step = Math.max(300, Math.round(window.innerHeight * 0.7));
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await settle();
      worst = Math.max(worst, hiddenInView());
    }
    window.scrollTo(0, document.body.scrollHeight);
    await settle();
    worst = Math.max(worst, hiddenInView());
    window.scrollTo(0, 0);
    return worst;
  });
  await page.waitForTimeout(700);
  const info = await page.evaluate((isPhone) => {
    const vw = document.documentElement.clientWidth;
    const overflow = [];
    if (document.documentElement.scrollWidth > vw + 1) {
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.right > vw + 1 && r.width > 0 && getComputedStyle(el).position !== "fixed") {
          // Inside its own sideways scroller is fine; only report what widens the page.
          let p = el.parentElement, clipped = false;
          while (p && p !== document.body) {
            const o = getComputedStyle(p).overflowX;
            if (o === "auto" || o === "scroll" || o === "hidden" || o === "clip") { clipped = true; break; }
            p = p.parentElement;
          }
          if (!clipped) overflow.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 3).join(".")} right=${Math.round(r.right)}`);
          if (overflow.length > 3) break;
        }
      }
    }
    const brokenImgs = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.src && !i.src.startsWith("data:")).map((i) => i.currentSrc || i.src);
    const hrefs = [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05;
    };
    const smallInputs = [];
    const smallTargets = [];
    if (isPhone) {
      for (const el of document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]), select, textarea")) {
        if (!visible(el)) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < 16) smallInputs.push(`${el.tagName.toLowerCase()}[name=${el.getAttribute("name") ?? el.id ?? "?"}] ${size}px`);
      }
      const label = (el) => (el.getAttribute("aria-label") || el.textContent || el.getAttribute("href") || "").trim().replace(/\s+/g, " ").slice(0, 40);
      for (const el of document.querySelectorAll('button, [role="button"], [role="menuitem"], [role="tab"], a[href], input[type=checkbox], input[type=radio], summary')) {
        if (!visible(el) || el.closest("[aria-hidden=true]") || el.disabled) continue;
        const s = getComputedStyle(el);
        // A link that is part of a sentence is text, not a control (WCAG 2.5.8 inline exception).
        if (el.tagName === "A" && s.display === "inline") continue;
        const r = el.getBoundingClientRect();
        // Screen-reader-only links (the skip link) have no visible box to tap.
        if (r.width <= 2 && r.height <= 2) continue;
        let w = r.width, h = r.height;
        // The site widens small controls with an invisible pseudo-element (`tap-target`); count it.
        for (const pseudo of ["::before", "::after"]) {
          const ps = getComputedStyle(el, pseudo);
          if (ps.content !== "none" && ps.position === "absolute") {
            w = Math.max(w, parseFloat(ps.width) || 0);
            h = Math.max(h, parseFloat(ps.height) || 0);
          }
        }
        // A checkbox/radio inside a label is tapped through the label.
        const lab = el.closest("label");
        if (lab) { const lr = lab.getBoundingClientRect(); w = Math.max(w, lr.width); h = Math.max(h, lr.height); }
        if (w < 43.5 || h < 43.5) smallTargets.push(`${el.tagName.toLowerCase()} "${label(el)}" ${Math.round(w)}x${Math.round(h)}`);
      }
    }
    // The desktop nav must stop short of the header buttons. Overlap is not
    // overflow, so the scroll-width check above cannot see it.
    let navClash = "";
    const nav = document.querySelector('header nav[aria-label="Main"]');
    if (nav && getComputedStyle(nav).display !== "none") {
      const right = Math.max(...[...nav.querySelectorAll("a,button")].map((e) => e.getBoundingClientRect().right));
      const left = nav.parentElement?.nextElementSibling?.getBoundingClientRect().left ?? Infinity;
      if (right > left - 4) navClash = `nav ends at ${Math.round(right)}, buttons start at ${Math.round(left)}`;
    }
    return { scrollWidth: document.documentElement.scrollWidth, vw, overflow, brokenImgs, hrefs, smallInputs, smallTargets, navClash, title: document.title };
  }, phone);
  for (const h of info.hrefs) {
    if (!h || !h.startsWith("/") || h.startsWith("//")) continue;
    const clean = h.split("#")[0];
    if (!clean || /^\/(go|dl|unlock|api)\//.test(clean)) continue;
    if (!links.has(clean)) links.set(clean, name);
  }
  if (screenshot) await shot(page, path.join(SHOTS, tag), name, false);
  const status = res?.status();
  const where = `${tag} ${name}`;
  check(`${where}: HTTP ${expected404 ? 404 : 200}`, expected404 ? status === 404 : status === 200, `${status} ${redact(page.url())}`);
  check(`${where}: no console errors`, errs.length === 0, errs.join(" | "));
  check(`${where}: no failed requests`, bad.length === 0, bad.join(" | "));
  check(`${where}: no broken images`, info.brokenImgs.length === 0, info.brokenImgs.join(" "));
  check(`${where}: no sideways scrolling`, info.overflow.length === 0 && info.scrollWidth <= info.vw + 1, `scrollWidth ${info.scrollWidth} > ${info.vw}: ${info.overflow.join(", ")}`);
  check(`${where}: header nav clear of the header buttons`, !info.navClash, info.navClash);
  check(`${where}: nothing on screen left hidden by scroll animations`, stuck === 0, `${stuck} element(s) hidden while in view`);
  check(`${where}: has a title`, info.title.length > 3, info.title);
  check(`${where}: loads in under 5 s`, loadMs < 5000, `${loadMs} ms`);
  if (phone) {
    check(`${where}: inputs are at least 16px (no iOS zoom)`, info.smallInputs.length === 0, info.smallInputs.join(", "));
    check(`${where}: tap targets are at least 44px`, info.smallTargets.length === 0, `${info.smallTargets.length}: ${info.smallTargets.slice(0, 8).join(" | ")}`);
  }
  await page.close();
}

const adminSession = await sessionFor(ADMIN_USER.id, ADMIN_USER.email, "ADMIN");
const freeSession = await sessionFor("e2efreeuser000000000000001", "e2e-free@test.local");

// E2E_QUICK=1: phones only, public pages only (fast loop while fixing layout).
const QUICK = Boolean(process.env.E2E_QUICK);

for (const engine of engineNames()) {
  console.log(`\n=== ${engine} ===`);
  const browser = await launch(engine);
  const run = async (device, pages, opts = {}, ctxOpts = {}) => {
    const tag = `${engine}/${device}${ctxOpts.scheme === "light" ? "/light" : ""}${ctxOpts.reducedMotion ? "/reduced-motion" : ""}${opts.label ? `/${opts.label}` : ""}`;
    const ctx = await newDevice(browser, engine, device, ctxOpts);
    for (const [name, url] of pages) await inspect(ctx, tag, name, url, opts);
    await ctx.close();
  };
  const keyPages = PUBLIC.filter(([n]) => KEY.includes(n));

  // Every public page on the four main sizes.
  await run("phone-small", PUBLIC, { phone: true });
  await run("phone-large", PUBLIC, { phone: true, screenshot: true });
  if (QUICK) {
    await browser.close();
    continue;
  }
  await run("tablet-portrait", PUBLIC);
  await run("laptop", PUBLIC, { screenshot: true });
  // Key pages on the remaining sizes and orientations.
  for (const device of ["phone-landscape", "tablet-landscape", "desktop-wide", "tv-4k"]) await run(device, keyPages, { screenshot: device !== "tv-4k" });
  if (engine === "chromium") await run("telegram-android", keyPages, { phone: true, screenshot: true });
  // Light theme and reduced motion.
  await run("phone-large", keyPages, { phone: true, screenshot: true }, { scheme: "light" });
  await run("laptop", keyPages, { screenshot: true }, { scheme: "light" });
  await run("phone-large", keyPages, {}, { reducedMotion: true });
  // Signed-in member pages and the whole admin panel, phone and laptop.
  for (const device of ["phone-large", "laptop"]) {
    await run(device, SIGNED_IN, { label: "member", screenshot: true }, { session: freeSession, ip: "10.50.0.2" });
    await run(device, ADMIN_PAGES, { label: "admin", screenshot: true }, { session: adminSession, ip: "10.50.0.3" });
  }
  await run("laptop", ADMIN_PAGES.slice(0, 4), { label: "admin" }, { session: adminSession, ip: "10.50.0.3", scheme: "light" });
  await browser.close();
}

console.log(`\nchecking ${links.size} internal links`);
const broken = [];
const list = [...links.entries()];
for (let i = 0; i < list.length; i += 8) {
  await Promise.all(
    list.slice(i, i + 8).map(async ([href, from]) => {
      const r = await fetch(BASE + href, { redirect: "follow", headers: { "cf-connecting-ip": "10.50.0.9", cookie: `authjs.session-token=${adminSession}` } }).catch(() => ({ status: 0 }));
      if (!(r.status >= 200 && r.status < 400)) broken.push(`${r.status} ${redact(href)} (linked from ${from})`);
    })
  );
}
check(`all ${links.size} internal links work`, broken.length === 0, broken.join(" | "));

await prisma.$disconnect();
process.exit(finish(`sweep-${engineNames().join("-")}`) ? 1 : 0);
