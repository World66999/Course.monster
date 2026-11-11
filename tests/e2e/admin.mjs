// Admin panel: real sign-in through the form, then the actions an admin
// performs day to day, in each engine on a laptop and (Chromium) on a phone.
//  - wrong password refused, right password in, sign out
//  - dashboard charts and range switch
//  - course: create, find by search and filters, bulk feature / unpublish,
//    reorder (keyboard and drag), edit, delete
//  - payments list filters and the subscriptions tab
//  - the panel is closed to visitors and to ordinary members
import path from "node:path";
import { ADMIN, ADMIN_USER, OUT, check, engineNames, finish, launch, newDevice, prisma, q, reactReady, resetTestData, seen, sessionFor, shot, sleep, x } from "./lib.mjs";

const SHOTS = path.join(OUT, "screens", "admin");

await resetTestData();

async function signIn(page, password) {
  await page.goto(`${ADMIN}/login`);
  await reactReady(page.locator("#email"));
  await page.locator("#email").fill(ADMIN_USER.email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function adminRun(engine, browser, device) {
  const tag = `${engine}/${device}`;
  const ctx = await newDevice(browser, engine, device, { ip: `10.80.${engine.length}.${device.length}` });
  // The login form reports a refused password through a 200 response; nothing to ignore.
  const page = await ctx.newPage();
  const slug = `e2e-${engine}-${device}`.toLowerCase();
  const title = `E2E Course ${engine} ${device}`;

  // ---- access control ----
  await page.goto(ADMIN);
  const onLogin = () => new URL(page.url()).pathname.endsWith("/login");
  check(`${tag}: the panel redirects a visitor to its login page`, onLogin(), page.url());

  // ---- sign in ----
  await signIn(page, "definitely-wrong-password");
  await page.getByText("Invalid email or password.").waitFor({ timeout: 15_000 }).catch(() => {});
  check(`${tag}: wrong password is refused with a message`, await page.getByText("Invalid email or password.").isVisible().catch(() => false));
  await signIn(page, ADMIN_USER.password);
  await page.getByRole("heading", { name: "Dashboard" }).waitFor({ timeout: 20_000 }).catch(() => {});
  check(`${tag}: correct password opens the dashboard`, await page.getByRole("heading", { name: "Dashboard" }).isVisible().catch(() => false), page.url().replace(ADMIN, "<admin>"));

  // ---- dashboard ----
  const charts = await page.locator('svg[role="img"]').count();
  check(`${tag}: dashboard draws the five charts (visitors, unlocks, downloads, sales, revenue)`, charts === 5, charts);
  check(`${tag}: dashboard shows revenue to an administrator`, await page.getByText(/^Revenue · 30 days$/).isVisible().catch(() => false));
  const firstChart = page.getByRole("group", { name: /Visitors and page views/ });
  await firstChart.focus();
  await page.keyboard.press("ArrowRight");
  check(`${tag}: chart values are readable by keyboard (tooltip opens)`, await firstChart.getByRole("status").isVisible().catch(() => false));
  await page.getByText("View as table").first().click();
  check(`${tag}: every chart has a table view`, await page.locator("details[open] table").first().isVisible().catch(() => false));
  await page.locator("main").getByRole("link", { name: "7 days" }).click();
  await page.waitForURL(/range=7/);
  check(`${tag}: range switch to 7 days works`, await page.getByText(/Revenue · 7 days/).isVisible().catch(() => false));
  await shot(page, path.join(SHOTS, tag), "dashboard", true);

  // ---- create a course ----
  await page.goto(`${ADMIN}/courses/new`);
  await reactReady(page.locator("#title"));
  await page.locator("#title").fill(title);
  await page.locator("#slug").fill(slug);
  await page.locator("#shortDescription").fill("Created by the browser test.");
  const description = page.locator('textarea[name="description"], #description').first();
  await description.fill("## About\n\nA course created by the automated browser test.");
  await page.locator("#downloadUrl").fill("https://example.com/e2e-course.zip");
  await page.getByRole("switch", { name: "Published" }).click();
  await page.getByRole("button", { name: "Create course" }).first().click();
  await page.waitForURL((u) => !u.pathname.endsWith("/courses/new"), { timeout: 20_000 }).catch(() => {});
  const created = (await q(`select id, published, featured from courses where slug=$1`, slug))[0];
  check(`${tag}: creating a course saves it as published`, Boolean(created?.published), JSON.stringify(created));

  const publicRes = await page.goto(`/courses/${slug}`);
  check(`${tag}: the new course is live on the public site`, publicRes?.status() === 200 && (await seen(page.getByRole("heading", { level: 1, name: title }))));

  // ---- find it: search + filter ----
  await page.goto(`${ADMIN}/courses`);
  await reactReady(page.getByLabel("Search by title or slug…"));
  await page.getByLabel("Search by title or slug…").fill(title);
  await page.waitForURL(/q=/, { timeout: 10_000 }).catch(() => {});
  const row = page.locator("tbody tr", { hasText: title });
  await row.waitFor({ timeout: 10_000 }).catch(() => {});
  check(`${tag}: search finds the course`, (await row.count()) === 1, await page.locator("tbody tr").count());
  await page.goto(`${ADMIN}/courses?type=free&status=published&q=${encodeURIComponent(title)}`);
  check(`${tag}: type and status filters keep it listed`, (await page.locator("tbody tr", { hasText: title }).count()) === 1);
  await page.goto(`${ADMIN}/courses?type=premium&q=${encodeURIComponent(title)}`);
  check(`${tag}: the Premium filter correctly hides a free course`, (await page.locator("tbody tr", { hasText: title }).count()) === 0);

  // ---- bulk actions ----
  await page.goto(`${ADMIN}/courses?q=${encodeURIComponent(title)}`);
  await page.getByLabel(`Select ${title}`).check();
  await page.getByRole("button", { name: "Feature", exact: true }).click();
  await page.waitForFunction((t) => [...document.querySelectorAll("tbody tr")].some((r) => r.textContent.includes(t) && r.textContent.includes("Featured")), title, { timeout: 10_000 }).catch(() => {});
  check(`${tag}: bulk "Feature" marks the course featured`, (await q(`select featured from courses where slug=$1`, slug))[0]?.featured === true);
  await page.getByLabel(`Select ${title}`).check();
  await page.getByRole("button", { name: "Unpublish", exact: true }).click();
  await page.waitForFunction((t) => [...document.querySelectorAll("tbody tr")].some((r) => r.textContent.includes(t) && r.textContent.includes("Draft")), title, { timeout: 10_000 }).catch(() => {});
  check(`${tag}: bulk "Unpublish" takes it off the site`, (await q(`select published from courses where slug=$1`, slug))[0]?.published === false);
  // The public page is cached; the unpublish clears that cache. Allow a moment for it.
  let goneStatus = 0;
  for (let i = 0; i < 10 && goneStatus !== 404; i++) {
    goneStatus = (await page.request.get(`/courses/${slug}`)).status();
    if (goneStatus !== 404) await sleep(500);
  }
  check(`${tag}: an unpublished course is no longer public (404)`, goneStatus === 404, goneStatus);

  // ---- reorder ----
  await page.goto(`${ADMIN}/courses`);
  const order = () => page.locator("tbody tr td:nth-child(3) a").allTextContents();
  const before = await order();
  const handle = page.getByRole("button", { name: /^Reorder / }).nth(0);
  await handle.focus();
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction((first) => document.querySelector("tbody tr td:nth-child(3) a")?.textContent !== first, before[0], { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.reload();
  const afterKey = await order();
  check(`${tag}: reorder by keyboard moves the first course down and it persists`, afterKey[1] === before[0] && afterKey[0] === before[1], `${afterKey.slice(0, 2).join(" | ")}`);
  if (device === "laptop") {
    // Drag the (now) second row back above the first with the pointer.
    const from = await page.getByRole("button", { name: /^Reorder / }).nth(1).boundingBox();
    const to = await page.locator("tbody tr").nth(0).boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, to.y + 4, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(1500);
    await page.reload();
    const afterDrag = await order();
    check(`${tag}: drag-to-reorder puts it back on top and it persists`, afterDrag[0] === before[0], afterDrag.slice(0, 2).join(" | "));
  }
  const dupes = (await q(`select count(*)::int n from (select "order" from courses group by "order" having count(*) > 1) t`))[0].n;
  check(`${tag}: after reordering, every course has its own position`, dupes === 0, dupes);
  await shot(page, path.join(SHOTS, tag), "courses", true);

  // ---- edit ----
  await page.goto(`${ADMIN}/courses/${created.id}/edit`);
  await page.locator("#shortDescription").fill("Edited by the browser test.");
  await page.getByRole("button", { name: "Save changes" }).first().click();
  await page.waitForTimeout(1500);
  check(`${tag}: editing a course saves`, (await q(`select "shortDescription" s from courses where slug=$1`, slug))[0]?.s === "Edited by the browser test.");

  // ---- delete ----
  await page.goto(`${ADMIN}/courses?q=${encodeURIComponent(title)}`);
  await page.getByLabel(`Select ${title}`).check();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await page.waitForFunction((t) => ![...document.querySelectorAll("tbody tr")].some((r) => r.textContent.includes(t)), title, { timeout: 10_000 }).catch(() => {});
  check(`${tag}: delete (with confirmation) removes the course`, (await q(`select count(*)::int n from courses where slug=$1`, slug))[0].n === 0);

  // ---- payments ----
  await page.goto(`${ADMIN}/payments`);
  check(`${tag}: payments page lists both gateways together`, await page.getByRole("heading", { name: /Payments & subscriptions/ }).isVisible());
  const main = page.locator("main");
  await main.getByRole("link", { name: "Paid", exact: true }).click();
  await page.waitForURL(/state=paid/);
  const statuses = await page.locator("tbody tr td:nth-child(6)").allTextContents();
  check(`${tag}: "Paid" filter shows only settled payments`, statuses.every((s) => /PAID|FINISHED|No payments/.test(s) || s === ""), statuses.slice(0, 5).join(","));
  await main.getByRole("group", { name: "Gateway" }).getByRole("link", { name: "Razorpay", exact: true }).click();
  await page.waitForURL(/gateway=razorpay/);
  const gateways = await page.locator("tbody tr td:nth-child(2)").allTextContents();
  check(`${tag}: gateway filter shows only Razorpay rows`, gateways.every((g) => g === "Razorpay" || g === ""), gateways.slice(0, 5).join(","));
  await main.getByRole("link", { name: "Subscriptions", exact: true }).click();
  await page.waitForURL(/tab=subscriptions/);
  await main.getByRole("link", { name: "Active", exact: true }).click();
  await page.waitForURL(/status=ACTIVE/);
  const subStatuses = await page.locator("tbody tr td:nth-child(3)").allTextContents();
  check(`${tag}: subscription list filters by status`, subStatuses.every((s) => s === "ACTIVE" || s === ""), subStatuses.slice(0, 5).join(","));
  await shot(page, path.join(SHOTS, tag), "payments", true);

  // ---- sign out ----
  await page.goto(ADMIN);
  if (device !== "laptop") await page.getByRole("button", { name: "Open sidebar" }).click();
  await page.getByRole("button", { name: "Sign out" }).last().click();
  await page.waitForURL(/\/login$/, { timeout: 15_000 }).catch(() => {});
  await page.goto(ADMIN);
  check(`${tag}: after signing out the panel is closed again`, onLogin(), page.url());
  check(`${tag}: no browser errors in the admin run`, ctx.errors.length === 0, ctx.errors.join(" | "));
  await ctx.close();
}

async function outsiders(browser) {
  // An ordinary signed-in member must not get in either.
  const ctx = await newDevice(browser, "chromium", "laptop", { ip: "10.80.9.9", session: await sessionFor("e2efreeuser000000000000001", "e2e-free@test.local") });
  const page = await ctx.newPage();
  await page.goto(`${ADMIN}/courses`);
  await page.waitForTimeout(1500);
  check("a normal member cannot open the admin panel", !(await page.getByRole("heading", { name: "Courses", exact: true }).isVisible().catch(() => false)) && (await page.locator("tbody tr").count()) === 0, page.url());
  const html = await (await page.request.get("/")).text();
  check("the secret admin path does not appear in the public home page", !html.includes(ADMIN.slice(1)));
  await ctx.close();
}

for (const engine of engineNames()) {
  const browser = await launch(engine);
  await adminRun(engine, browser, "laptop").catch((e) => check(`${engine}/laptop: admin run finished`, false, e.stack));
  if (engine === "chromium") {
    await adminRun(engine, browser, "phone-large").catch((e) => check(`${engine}/phone-large: admin run finished`, false, e.stack));
    await outsiders(browser).catch((e) => check("outsider checks ran", false, e.stack));
  }
  await browser.close();
}
await x(`delete from courses where slug like 'e2e-%'`);
await prisma.$disconnect();
process.exit(finish("admin") ? 1 : 0);
