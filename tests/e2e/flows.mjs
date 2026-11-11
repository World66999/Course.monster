// Free-unlock flows, end to end in real browsers:
//  - anonymous visitor on a phone in each engine: three unlocks through
//    VPLink → GPLinks → LinkShortify, the limit on the fourth, free re-open
//  - edge cases: returning too fast, another browser, re-using a link
//  - Premium member: straight to the file, nothing counted
//  - the Telegram bot hand-off, opened in Telegram's in-app browser
//  - the site-wide "free unlocks left" counter
//
// Each unlock has a real 20-second minimum on the server, so this takes a
// couple of minutes; the three engines run side by side.
import path from "node:path";
import { BASE, OUT, check, clearMockLog, engineNames, externalTarget, finish, launch, mockLog, newDevice, passGate, prisma, progressOf, q, resetTestData, sessionFor, shot, sleep, x } from "./lib.mjs";

const SHOTS = path.join(OUT, "screens", "unlock-flow");
const MIN_WAIT_MS = 20_600;

await resetTestData();
const courses = await q(`select id, slug, title, "downloadUrl" from courses where published and not premium and "downloadUrl" is not null order by "createdAt" desc limit 20`);
const premiumCourse = (await q(`select id, slug, "downloadUrl" from courses where published and premium order by "createdAt" desc limit 1`))[0];
const PROVIDERS = [["vplink", "VPLink"], ["gplinks", "GPLinks"], ["linkshortify", "LinkShortify"]];
const sameUrl = (a, b) => {
  try {
    return new URL(a).href === new URL(b).href;
  } catch {
    return false;
  }
};

/** What the read-only counter endpoint says for this visitor. */
const counter = (ctx) => ctx.request.get("/api/free-unlocks/status").then((r) => r.json());

async function anonymousFlow(engine, browser, device, ip, list) {
  const tag = `${engine}/${device}`;
  const ctx = await newDevice(browser, engine, device, { ip });
  const page = await ctx.newPage();

  const first = await counter(ctx);
  check(`${tag}: counter starts at 0 used, limit 3, before any download page`, first.premium === false && first.used === 0 && first.limit === 3, JSON.stringify(first));

  for (let k = 0; k < 3; k++) {
    const c = list[k];
    const [provider, label] = PROVIDERS[k];
    const res = await page.goto(`/courses/${c.slug}`);
    check(`${tag}: course page ${k + 1} loads`, res?.status() === 200, res?.status());
    if (k === 1) {
      const chip = page.locator("[data-free-chip]").first();
      await chip.waitFor({ timeout: 10_000 }).catch(() => {});
      check(`${tag}: course page shows "2 of 3 free unlocks left today"`, (await chip.textContent().catch(() => ""))?.includes("2 of 3 free unlocks left today"), await chip.textContent().catch(() => "missing"));
    }
    await page.locator(`a[href="/download/${c.slug}"]:visible`).first().click();
    await page.waitForURL(`**/download/${c.slug}`);
    check(`${tag}: unlock ${k + 1} shows "Free courses today: ${k}/3 used"`, (await progressOf(page)) === `${k}/3`, await progressOf(page));
    check(`${tag}: unlock ${k + 1} says it uses ${label}`, await page.getByText(`This unlock uses ${label}`).isVisible().catch(() => false));
    if (k === 0) await shot(page, path.join(SHOTS, tag), "1-download-page", true);
    const init = await passGate(page);
    check(`${tag}: unlock ${k + 1} started`, init.status === 200, init.status);
    const short = new URL(await externalTarget(page));
    check(`${tag}: unlock ${k + 1} went to ${label}`, short.host === `${provider}.mock`, short.host);
    const ret = short.searchParams.get("u");
    check(`${tag}: unlock ${k + 1} short link returns to a one-time /unlock link`, /\/unlock\/[A-Za-z0-9_-]{40,}$/.test(ret ?? ""), ret);
    await sleep(Math.max(0, init.at + MIN_WAIT_MS - Date.now()));
    await page.goto(ret);
    const opened = await externalTarget(page).catch(() => page.url());
    check(`${tag}: unlock ${k + 1} completed, the course file opens`, sameUrl(opened, c.downloadUrl), opened);
    await page.goto(`/download/${c.slug}`);
    check(`${tag}: counter now ${k + 1}/3 and the course is marked unlocked`, (await progressOf(page)) === `${k + 1}/3` && (await page.getByText("You already unlocked this course").isVisible()), await progressOf(page));
  }

  const afterThree = await counter(ctx);
  check(`${tag}: counter endpoint says 3 of 3 used`, afterThree.used === 3 && afterThree.limit === 3, JSON.stringify(afterThree));

  await page.goto(`/download/${list[3].slug}`);
  check(`${tag}: 4th course shows "Daily free limit reached"`, await page.getByText("Daily free limit reached").isVisible().catch(() => false));
  const buy = page.getByRole("link", { name: /Buy Premium/ });
  check(`${tag}: …with a Buy Premium link to /premium`, (await buy.isVisible().catch(() => false)) && (await buy.getAttribute("href"))?.startsWith("/premium"));
  check(`${tag}: …and no download button`, !(await page.getByRole("button", { name: /Get download link/ }).isVisible().catch(() => false)));
  await shot(page, path.join(SHOTS, tag), "2-limit-reached", true);

  await page.goto(`/download/${list[0].slug}`);
  const navsBefore = ctx.externalNavs.length;
  await passGate(page);
  const reopened = await externalTarget(page).catch(() => page.url());
  check(`${tag}: re-opening an unlocked course goes straight to the file, no shortener`, sameUrl(reopened, list[0].downloadUrl) && !ctx.externalNavs.slice(navsBefore).some((u) => u.includes(".mock/")), reopened);
  check(`${tag}: no browser errors during the flow`, ctx.errors.length === 0, ctx.errors.join(" | "));
  await ctx.close();
}

async function edgeCases(browser) {
  const c = courses[12];
  const E = await newDevice(browser, "chromium", "laptop", { ip: "10.20.0.1" });
  const F = await newDevice(browser, "chromium", "laptop", { ip: "10.20.0.2" });
  const pe = await E.newPage();
  const pf = await F.newPage();
  await pe.goto(`/download/${c.slug}`);
  const init = await passGate(pe);
  const ret = new URL(await externalTarget(pe)).searchParams.get("u");
  await pe.goto(ret);
  check("too fast: returning at once is refused", pe.url().includes("unlock=early"), pe.url());
  check("too fast: nothing counted (still 0/3)", (await progressOf(pe)) === "0/3", await progressOf(pe));
  await sleep(Math.max(0, init.at + MIN_WAIT_MS - Date.now()));
  await pf.goto(ret);
  check("other browser: the unlock link is refused", pf.url().includes("unlock=browser"), pf.url());
  check("other browser: nothing counted for it", (await progressOf(pf)) === "0/3", await progressOf(pf));
  await pe.goto(ret);
  check("original browser after the wait: the file opens", sameUrl(await externalTarget(pe).catch(() => pe.url()), c.downloadUrl));
  await pe.goto(ret);
  check("re-using the same unlock link is refused", pe.url().includes("unlock=used"), pe.url());
  check("…and the count stays 1/3", (await progressOf(pe)) === "1/3", await progressOf(pe));
  check("edge cases: no browser errors", E.errors.length + F.errors.length === 0, [...E.errors, ...F.errors].join(" | "));
  await E.close();
  await F.close();

  // Premium member: straight to the file, no counter, no shortener.
  const P = await newDevice(browser, "chromium", "phone-large", { ip: "10.20.0.9", session: await sessionFor("e2epremuser000000000000001", "e2e-prem@test.local") });
  const pp = await P.newPage();
  const status = await counter(P);
  check("premium member: counter endpoint reports Premium, no numbers", status.premium === true && status.used === undefined, JSON.stringify(status));
  await pp.goto(`/courses/${courses[13].slug}`);
  await pp.locator(`a[href="/download/${courses[13].slug}"]:visible`).first().click();
  check("premium member: a free course opens directly", sameUrl(await externalTarget(pp).catch(() => pp.url()), courses[13].downloadUrl));
  if (premiumCourse) {
    await pp.goto(`/download/${premiumCourse.slug}`);
    check("premium member: a Premium course opens directly", sameUrl(await externalTarget(pp).catch(() => pp.url()), premiumCourse.downloadUrl));
  }
  check("premium member: never sent to a shortener", !P.externalNavs.some((u) => u.includes(".mock/")), P.externalNavs.join(" "));
  const n = (await q(`select count(*)::int n from free_unlock_sessions where "userId"='e2epremuser000000000000001'`))[0].n;
  const qn = (await q(`select count(*)::int n from free_unlock_quotas where "subjectKey"='u:e2epremuser000000000000001'`))[0].n;
  check("premium member: no unlock attempt and no daily count recorded", n === 0 && qn === 0, `${n} ${qn}`);
  await P.close();

  if (premiumCourse) {
    const A = await newDevice(browser, "chromium", "phone-large", { ip: "10.20.0.10" });
    const pa = await A.newPage();
    await pa.goto(`/download/${premiumCourse.slug}`);
    check("anonymous visitor on a Premium course sees the locked view, no download", (await pa.getByText("This is a Premium course.").isVisible()) && !(await pa.getByRole("button", { name: /Get download link/ }).isVisible().catch(() => false)));
    await A.close();
  }
}

async function botFlow(browser) {
  const WEBHOOK = `${BASE}/api/telegram/webhook/${process.env.TELEGRAM_WEBHOOK_PATH}`;
  let uid = Math.floor(Date.now() / 1000);
  async function tap(tgId, data) {
    await clearMockLog();
    const res = await fetch(WEBHOOK, {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": process.env.TELEGRAM_WEBHOOK_SECRET },
      body: JSON.stringify({ update_id: ++uid, callback_query: { id: `cb${uid}`, from: { id: tgId, is_bot: false, first_name: "Demo" }, data, message: { message_id: 77, chat: { id: tgId } } } }),
    });
    await sleep(1500);
    const msgs = (await mockLog()).filter((m) => m.telegram === "editMessageText" || m.telegram === "sendMessage");
    return { status: res.status, msg: msgs.at(-1)?.body };
  }
  const bad = await fetch(WEBHOOK, { method: "POST", headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "wrong" }, body: "{}" });
  check("bot: webhook refuses a wrong secret", bad.status === 401 || bad.status === 403 || bad.status === 404, bad.status);

  const TG = 700000123;
  const ctx = await newDevice(browser, "chromium", "telegram-android", { ip: "10.30.0.1" });
  const page = await ctx.newPage();
  for (let k = 0; k < 2; k++) {
    const c = courses[14 + k];
    const [provider, label] = PROVIDERS[k];
    const t = await tap(TG, `d:${c.id}`);
    check(`bot unlock ${k + 1}: message shows "Free courses today: ${k}/3 used" and ${label}`, t.status === 200 && t.msg?.text?.includes(`Free courses today: ${k}/3 used`) && t.msg?.text?.includes(label), t.msg?.text);
    const btn = t.msg?.reply_markup?.inline_keyboard?.flat().find((b) => b.url?.includes("/download/"));
    check(`bot unlock ${k + 1}: button hands off to the website with a signed token`, Boolean(btn?.url?.includes("?src=")), JSON.stringify(t.msg?.reply_markup));
    if (!btn?.url) continue;
    const handoff = new URL(btn.url);
    await page.goto(BASE + handoff.pathname + handoff.search);
    check(`bot unlock ${k + 1}: website shows the bot user's ${k}/3`, (await progressOf(page)) === `${k}/3`, await progressOf(page));
    if (k === 0) await shot(page, path.join(SHOTS, "telegram-bot"), "download-page-in-telegram-browser", true);
    const init = await passGate(page);
    const bs = new URL(await externalTarget(page));
    check(`bot unlock ${k + 1}: ${label} short link`, bs.host === `${provider}.mock`, bs.href);
    await sleep(Math.max(0, init.at + MIN_WAIT_MS - Date.now()));
    await page.goto(bs.searchParams.get("u"));
    check(`bot unlock ${k + 1}: the file opens`, sameUrl(await externalTarget(page).catch(() => page.url()), c.downloadUrl));
  }
  const sk = (await q(`select count from free_unlock_quotas where "subjectKey"=$1`, `tg:${TG}`))[0];
  check("bot user is counted by Telegram id: 2 today", sk?.count === 2, JSON.stringify(sk));
  // Fill the day and check the bot's own limit message.
  await x(`update free_unlock_quotas set count = 3 where "subjectKey"=$1`, `tg:${TG}`);
  const t = await tap(TG, `d:${courses[16].id}`);
  check("bot at the limit: 'Daily free limit reached' with a Buy Premium button", t.msg?.text?.includes("Daily free limit reached") && t.msg?.reply_markup?.inline_keyboard?.flat().some((b) => /Buy Premium/.test(b.text)), t.msg?.text);
  check("bot flow: no browser errors", ctx.errors.length === 0, ctx.errors.join(" | "));
  await ctx.close();
}

const engines = engineNames();
const browsers = Object.fromEntries(await Promise.all(engines.map(async (e) => [e, await launch(e)])));
const started = Date.now();
await Promise.all(
  engines.map((engine, i) =>
    anonymousFlow(engine, browsers[engine], i === 0 ? "phone-large" : i === 1 ? "phone-small" : "phone-large", `10.10.0.${i + 1}`, courses.slice(i * 4, i * 4 + 4)).catch((e) =>
      check(`${engine}: anonymous flow ran to the end`, false, e.stack)
    )
  )
);
const chromiumBrowser = browsers.chromium ?? (await launch("chromium"));
await edgeCases(chromiumBrowser).catch((e) => check("edge cases ran to the end", false, e.stack));
await botFlow(chromiumBrowser).catch((e) => check("bot flow ran to the end", false, e.stack));
for (const b of new Set([...Object.values(browsers), chromiumBrowser])) await b.close();
await prisma.$disconnect();
console.log(`flows took ${Math.round((Date.now() - started) / 1000)} s`);
process.exit(finish("flows") ? 1 : 0);
