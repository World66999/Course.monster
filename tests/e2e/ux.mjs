// Behaviour checks that are not about a single page loading:
//  - dark/light theme: default, toggle, remembered, no flash of the wrong theme
//  - reduced motion and low-end devices: content is visible, nothing animates in
//  - saved courses and recently viewed (browser storage only, no sign-in)
//  - search: instant dialog, the courses filter bar, sorting
//  - keyboard: skip link, header menus, focus is visible
//  - SEO and installability: meta tags, Open Graph, JSON-LD, sitemap, robots, manifest
//  - site rules: Telegram is the only contact, no community-group link, no on-site chat
//  - works with JavaScript switched off (content and the search form)
import { BASE, check, engineNames, finish, hydrated, launch, newDevice, prisma, q, reactReady, resetTestData, seen, sleep } from "./lib.mjs";

await resetTestData();
// Titles are trimmed the way a browser computes an accessible name.
const tidy = (c) => ({ ...c, title: c.title.trim().replace(/\s+/g, " ") });
const course = tidy((await q(`select slug, title from courses where published and not premium order by downloads desc limit 1`))[0]);
const second = tidy((await q(`select slug, title from courses where published and not premium order by downloads desc offset 1 limit 1`))[0]);
/** The admin's default theme setting: "dark", "light" or "system" (follow the device). */
const defaultMode = (await q(`select value::jsonb->'theme'->>'defaultMode' as m from settings where key='site'`))[0]?.m ?? "dark";

async function theme(engine, browser) {
  const tag = `${engine} theme`;
  // A first-time visitor (nothing stored) on a device that prefers dark.
  const ctx = await newDevice(browser, engine, "phone-large", { scheme: "dark", storedTheme: "" });
  const page = await ctx.newPage();
  await page.goto("/");
  const isDark = () => page.evaluate(() => document.documentElement.classList.contains("dark"));
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  // "system" follows what the browser reports for the device (Firefox under
  // emulation reports light), so compare against the browser's own answer.
  const deviceDark = await page.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches);
  const expectDark = defaultMode === "dark" || (defaultMode === "system" && deviceDark);
  check(`${tag}: first visit follows the admin default ("${defaultMode}")`, (await isDark()) === expectDark, `dark=${await isDark()} device=${deviceDark}`);
  if (!(await isDark())) await page.getByRole("button", { name: /Switch to dark mode/ }).click();
  const darkBg = await bg();
  const toggle = page.getByRole("button", { name: /Switch to light mode/ });
  await toggle.waitFor({ timeout: 10_000 });
  await toggle.click();
  check(`${tag}: the toggle switches to light`, !(await isDark()) && (await bg()) !== darkBg, await bg());
  check(`${tag}: the choice is stored in the browser`, (await page.evaluate(() => localStorage.getItem("theme"))) === "light");
  // Reload: the stored choice must already be applied when the page's first
  // script after <body> opens runs, i.e. before anything is painted.
  await page.reload({ waitUntil: "commit" });
  const early = await page.evaluate(() => (document.body ? document.documentElement.classList.contains("dark") : null)).catch(() => null);
  await page.waitForLoadState("load");
  check(`${tag}: after reload it is still light, with no dark flash`, !(await isDark()) && early !== true, `early=${early}`);
  await page.goto(`/courses/${course.slug}`);
  check(`${tag}: the theme follows to other pages`, !(await isDark()));
  await page.getByRole("button", { name: /Switch to dark mode/ }).click();
  check(`${tag}: and switches back to dark`, await isDark());
  check(`${tag}: no browser errors`, ctx.errors.length === 0, ctx.errors.join(" | "));
  await ctx.close();
}

async function motion(engine, browser) {
  const tag = `${engine} motion`;
  // Reduced motion: nothing may be hidden waiting for an animation.
  const reduced = await newDevice(browser, engine, "phone-large", { reducedMotion: true });
  let page = await reduced.newPage();
  await page.goto("/");
  await page.waitForTimeout(1200);
  const pending = await page.evaluate(() => document.querySelectorAll('[data-reveal="pending"],[data-stagger="pending"]').length);
  check(`${tag}: with reduced motion nothing is hidden for a scroll animation`, pending === 0, pending);
  const longAnims = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" && (a.effect?.getTiming().duration ?? 0) > 50).length);
  check(`${tag}: with reduced motion no animation keeps running`, longAnims === 0, longAnims);
  await reduced.close();

  // Normal motion: below-the-fold blocks reveal as they are scrolled to.
  const normal = await newDevice(browser, engine, "laptop");
  page = await normal.newPage();
  await page.goto("/");
  await page.waitForTimeout(1500);
  const marked = await page.evaluate(() => document.querySelectorAll('[data-reveal="pending"],[data-stagger="pending"]').length);
  check(`${tag}: below-the-fold sections wait for scroll (reveal is active)`, marked > 0, marked);
  const firstScreenHidden = await page.evaluate(() => [...document.querySelectorAll('[data-reveal="pending"],[data-stagger="pending"]')].filter((el) => el.getBoundingClientRect().top < innerHeight * 0.9).length);
  check(`${tag}: nothing on the first screen is hidden`, firstScreenHidden === 0, firstScreenHidden);
  await page.mouse.wheel(0, 1400);
  await page.waitForFunction(() => document.querySelectorAll('[data-reveal="in"],[data-stagger="in"]').length > 0, null, { timeout: 8000 }).catch(() => {});
  const revealed = await page.evaluate(() => document.querySelectorAll('[data-reveal="in"],[data-stagger="in"]').length);
  check(`${tag}: scrolling reveals them`, revealed > 0, revealed);
  await normal.close();

  if (engine !== "chromium") return;
  // Low-end phone / data saver: decorative motion is switched off before first paint.
  const low = await browser.newContext({ viewport: { width: 360, height: 740 }, baseURL: BASE, isMobile: true, hasTouch: true });
  await low.addInitScript(() => {
    Object.defineProperty(navigator, "deviceMemory", { get: () => 1 });
    Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 2 });
  });
  page = await low.newPage();
  await page.goto("/");
  await page.waitForTimeout(1000);
  const state = await page.evaluate(() => ({
    perf: document.documentElement.dataset.perf,
    pending: document.querySelectorAll('[data-reveal="pending"],[data-stagger="pending"]').length,
    mesh: getComputedStyle(document.querySelector(".hero-mesh")).display,
    h1: document.querySelector("h1")?.getBoundingClientRect().height > 0,
  }));
  check(`low-end device: marked before paint, hero mesh and reveals off, content shown`, state.perf === "low" && state.pending === 0 && state.mesh === "none" && state.h1, JSON.stringify(state));
  await low.close();
}

async function library(engine, browser) {
  const tag = `${engine} saved`;
  const ctx = await newDevice(browser, engine, "phone-large", { ip: "10.90.0.1" });
  const page = await ctx.newPage();
  await page.goto("/saved");
  check(`${tag}: empty state when nothing is saved`, await page.getByText("Nothing saved yet").waitFor({ timeout: 10_000 }).then(() => true, () => false));
  // Save from a course card.
  await page.goto("/courses?sort=popular");
  await hydrated(page);
  const saveBtn = page.getByRole("button", { name: `Save ${course.title}` }).first();
  await saveBtn.scrollIntoViewIfNeeded();
  await saveBtn.click();
  check(`${tag}: saving from a card presses the button`, (await page.getByRole("button", { name: `Remove ${course.title} from Saved` }).first().getAttribute("aria-pressed")) === "true");
  check(`${tag}: a toast confirms it`, await seen(page.getByText("Saved to this device"), 8000));
  check(`${tag}: saving did not navigate away`, page.url().endsWith("/courses?sort=popular"), page.url());
  // Open two courses: both land in "Recently viewed".
  await page.goto(`/courses/${course.slug}`);
  check(`${tag}: the course page shows it as saved`, (await page.getByRole("button", { name: "Saved", exact: true }).getAttribute("aria-pressed")) === "true");
  await page.goto(`/courses/${second.slug}`);
  await page.waitForTimeout(500);
  await page.goto("/saved");
  const savedSection = page.locator('section[aria-labelledby="saved-heading"]');
  const recentSection = page.locator('section[aria-labelledby="viewed-heading"]');
  check(`${tag}: /saved lists the saved course`, await seen(savedSection.getByRole("link", { name: course.title })));
  check(`${tag}: /saved lists both recently viewed courses, newest first`, (await recentSection.getByRole("link").allTextContents()).map((t) => t.trim()).join("|").startsWith(`${second.title}|${course.title}`), (await recentSection.getByRole("link").allTextContents()).join("|"));
  await page.reload();
  check(`${tag}: it survives a reload (stored in the browser)`, await seen(savedSection.getByRole("link", { name: course.title })));
  const cookies = (await ctx.cookies()).map((c) => c.name);
  check(`${tag}: no sign-in or tracking cookie was needed`, !cookies.some((n) => /session-token/.test(n)), cookies.join(","));
  await page.goto("/");
  await page.waitForTimeout(800);
  check(`${tag}: the home page offers "Pick up where you left off"`, await page.getByRole("heading", { name: "Pick up where you left off" }).isVisible().catch(() => false));
  await page.goto("/saved");
  await savedSection.getByRole("button", { name: `Remove ${course.title}` }).click();
  check(`${tag}: removing it empties the list`, await page.getByText("Nothing saved yet").waitFor({ timeout: 8000 }).then(() => true, () => false));
  check(`${tag}: no browser errors`, ctx.errors.length === 0, ctx.errors.join(" | "));
  await ctx.close();
}

async function search(engine, browser) {
  const tag = `${engine} search`;
  const word = course.title.split(/\s+/).find((w) => w.length > 3) ?? course.title.slice(0, 4);
  const ctx = await newDevice(browser, engine, "laptop", { ip: "10.90.0.2" });
  const page = await ctx.newPage();
  await page.goto("/");
  await hydrated(page);
  // Instant search dialog from the header.
  // (`aria-haspopup`: the real control, not the placeholder shown while it loads.)
  await page.locator('header button[aria-label="Search"][aria-haspopup="dialog"]').first().click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ timeout: 10_000 });
  await dialog.getByLabel("Search query").fill(word);
  const hit = dialog.getByText(course.title, { exact: false }).first();
  check(`${tag}: typing shows instant results`, await hit.waitFor({ timeout: 10_000 }).then(() => true, () => false));
  await page.keyboard.press("Escape");
  check(`${tag}: Escape closes the dialog`, !(await dialog.isVisible().catch(() => false)));
  // The hero form is a plain GET form.
  await page.locator("#hero-search").fill(word);
  await page.locator("#hero-search").press("Enter");
  await page.waitForURL(/\/courses\?q=/);
  check(`${tag}: the hero search lands on filtered results`, await seen(page.getByRole("link", { name: course.title }).first(), 10_000));
  // Filter bar: live search, sort, category.
  await page.goto("/courses");
  await hydrated(page);
  const total = await page.getByText(/Showing \d+ of \d+ course/).textContent();
  const filterBox = page.getByRole("textbox", { name: "Search courses", exact: true });
  await reactReady(filterBox);
  await filterBox.fill("zzzz-no-such-course");
  await page.getByText("No courses found").waitFor({ timeout: 10_000 }).catch(() => {});
  check(`${tag}: a search with no match shows the empty state`, await page.getByText("No courses found").isVisible().catch(() => false));
  await page.getByRole("link", { name: "Clear filters" }).click();
  await page.waitForURL((u) => !u.search.includes("q="));
  check(`${tag}: "Clear filters" brings everything back`, (await page.getByText(/Showing \d+ of \d+ course/).textContent()) === total);
  await page.goto("/courses?sort=popular");
  const firstTitle = (await page.locator("article h3 a").first().textContent())?.trim();
  check(`${tag}: "Most popular" puts the most downloaded course first`, firstTitle === course.title, firstTitle);
  await page.goto("/courses?sort=az");
  const titles = await page.locator("article h3 a").allTextContents();
  const sorted = [...titles].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  check(`${tag}: A → Z sorting is in order`, titles.slice(0, 6).join("|").toLowerCase() === sorted.slice(0, 6).join("|").toLowerCase() || titles.length < 2, titles.slice(0, 4).join("|"));
  // Infinite scroll loads more when there is more.
  await page.goto("/courses");
  const before = await page.locator("article").count();
  const m = (await page.getByText(/Showing \d+ of \d+ course/).textContent()).match(/Showing (\d+) of (\d+)/);
  if (Number(m[2]) > Number(m[1])) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForFunction((n) => document.querySelectorAll("article").length > n, before, { timeout: 15_000 }).catch(() => {});
    check(`${tag}: scrolling loads more courses`, (await page.locator("article").count()) > before, `${before} → ${await page.locator("article").count()}`);
  }
  check(`${tag}: no browser errors`, ctx.errors.length === 0, ctx.errors.join(" | "));
  await ctx.close();
}

async function keyboard(engine, browser) {
  const tag = `${engine} keyboard`;
  const ctx = await newDevice(browser, engine, "laptop", { ip: "10.90.0.3" });
  const page = await ctx.newPage();
  await page.goto("/");
  await hydrated(page);
  // Safari only tabs to links with Option held; the skip link is checked where Tab reaches links.
  if (engine !== "webkit") {
    await page.keyboard.press("Tab");
    const skip = await page.evaluate(() => document.activeElement?.textContent?.trim());
    check(`${tag}: the first Tab stop is "Skip to content"`, skip === "Skip to content", skip);
  }
  const learn = page.getByRole("button", { name: "Learn" });
  await learn.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu");
  check(`${tag}: a header menu opens from the keyboard`, await menu.isVisible().catch(() => false));
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(150);
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("role"));
  check(`${tag}: arrow keys move into the menu`, focused === "menuitem", focused);
  await page.keyboard.press("Escape");
  check(`${tag}: Escape closes it and returns focus to the button`, !(await menu.isVisible().catch(() => false)) && (await page.evaluate(() => document.activeElement?.textContent?.trim().startsWith("Learn"))));
  await learn.click();
  await page.getByRole("menuitem", { name: "Courses" }).click();
  await page.waitForURL(/\/courses$/);
  check(`${tag}: a menu item navigates (works by click and tap, not hover)`, page.url().endsWith("/courses"));
  await ctx.close();

  // Touch: the same menu in the phone drawer.
  const phone = await newDevice(browser, engine, "phone-large", { ip: "10.90.0.4" });
  const p2 = await phone.newPage();
  await p2.goto("/");
  await hydrated(p2);
  await p2.locator('button[aria-label="Open menu"][aria-haspopup="dialog"]').click();
  const drawer = p2.getByRole("dialog");
  await drawer.waitFor({ timeout: 10_000 });
  check(`${tag}: the phone menu opens with every section`, (await drawer.getByRole("link", { name: "Courses" }).isVisible()) && (await drawer.getByRole("link", { name: "Premium Plans" }).isVisible()) && (await drawer.getByRole("link", { name: /Saved/ }).isVisible()));
  await drawer.getByRole("link", { name: "Premium Plans" }).click();
  await p2.waitForURL(/\/premium$/);
  check(`${tag}: the phone menu navigates and closes`, await drawer.waitFor({ state: "hidden", timeout: 8000 }).then(() => true, () => false));
  check(`${tag}: no browser errors`, ctx.errors.length + phone.errors.length === 0, [...ctx.errors, ...phone.errors].join(" | "));
  await phone.close();
}

async function seoAndRules() {
  const get = (p) => fetch(BASE + p, { headers: { "cf-connecting-ip": "10.90.0.9" } });
  const home = await (await get("/")).text();
  const coursePage = await (await get(`/courses/${course.slug}`)).text();
  check("seo: home has a title, description and canonical", /<title>[^<]{5,}<\/title>/.test(home) && /name="description" content="[^"]{20,}/.test(home) && /rel="canonical"/.test(home));
  check("seo: home has Open Graph and Twitter card tags", /property="og:title"/.test(home) && /property="og:site_name"/.test(home) && /name="twitter:card"/.test(home));
  check("seo: home has WebSite + Organization structured data", /"@type":"WebSite"/.test(home) && /"@type":"Organization"/.test(home));
  check("seo: course page has Course + Breadcrumb structured data and an og:image", /"@type":"Course"/.test(coursePage) && /"@type":"BreadcrumbList"/.test(coursePage) && /property="og:image"/.test(coursePage));
  check("seo: one h1 per page", (home.match(/<h1[\s>]/g) ?? []).length === 1 && (coursePage.match(/<h1[\s>]/g) ?? []).length === 1);
  const sitemap = await (await get("/sitemap.xml")).text();
  check("seo: sitemap lists the course, courses and Premium pages", sitemap.includes(`/courses/${course.slug}`) && sitemap.includes("/premium</loc>") && sitemap.includes("/courses</loc>"));
  const missingRes = await get("/courses/this-course-does-not-exist");
  const missing = await missingRes.text();
  check("seo: a missing course answers HTTP 404", missingRes.status === 404, missingRes.status);
  check("seo: a missing course is marked noindex", /noindex/.test(missing));
  for (const p of ["/download/this-course-does-not-exist", "/learn/nope", "/apps/nope", "/coding-channels/nope", "/no-such-page"]) {
    const r = await get(p);
    check(`seo: ${p} answers HTTP 404`, r.status === 404, r.status);
  }
  check("seo: private pages stay out of the sitemap", !/\/(saved|account|download|login)<\/loc>/.test(sitemap));
  const robots = await (await get("/robots.txt")).text();
  check("seo: robots.txt points at the sitemap", /Sitemap: .*\/sitemap\.xml/.test(robots));
  const dl = await (await get(`/download/${course.slug}`)).text();
  check("seo: download pages are noindex", /name="robots" content="noindex/.test(dl));

  const manifestRes = await get("/manifest.webmanifest");
  const manifest = await manifestRes.json().catch(() => null);
  check("pwa: manifest is served with name, start_url, standalone display", manifestRes.status === 200 && manifest?.name && manifest?.start_url && manifest?.display === "standalone", JSON.stringify(manifest)?.slice(0, 120));
  const icons = manifest?.icons ?? [];
  const iconOk = await Promise.all(icons.map((i) => get(i.src).then((r) => r.status === 200 && r.headers.get("content-type") === "image/png")));
  check("pwa: 192px, 512px and maskable icons exist and load", icons.some((i) => i.sizes === "192x192") && icons.some((i) => i.sizes === "512x512") && icons.some((i) => i.purpose === "maskable") && iconOk.every(Boolean));
  check("pwa: page links the manifest, theme colour and touch icon", /rel="manifest"/.test(home) && /name="theme-color"/.test(home) && /rel="apple-touch-icon"/.test(home));

  const headers = (await get("/")).headers;
  check("security headers are still sent", headers.get("x-content-type-options") === "nosniff" && headers.get("x-frame-options") === "DENY" && /default-src 'self'/.test(headers.get("content-security-policy") ?? ""));
  check("pages are compressed", ["gzip", "br"].includes((await fetch(BASE + "/", { headers: { "accept-encoding": "gzip, br" } })).headers.get("content-encoding") ?? ""));

  // ---- site rules ----
  const pages = ["/", "/courses", `/courses/${course.slug}`, "/premium", "/contact", "/how-to-download", "/terms", "/privacy", "/refund-policy"];
  const bodies = await Promise.all(pages.map(async (p) => [p, await (await get(p)).text()]));
  const visible = (html) => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ");
  check("rules: no community-group link anywhere on the site", bodies.every(([, h]) => !/Unique_One_Chat|community group/i.test(h)), bodies.filter(([, h]) => /Unique_One_Chat|community group/i.test(h)).map(([p]) => p).join(","));
  check("rules: no phone number or e-mail address is published", bodies.every(([, h]) => !/href="(tel|mailto):/i.test(h) && !/\+91[\s-]?\d{5}/.test(visible(h))), bodies.filter(([, h]) => /href="(tel|mailto):/i.test(h)).map(([p]) => p).join(","));
  const contact = bodies.find(([p]) => p === "/contact")[1];
  check("rules: the contact page offers Telegram", /t\.me\//.test(contact));
  check("rules: no on-site chat, comments or request board routes", (await Promise.all(["/chat", "/requests", "/premium-chat"].map((p) => get(p).then((r) => r.status)))).every((s) => s === 404));
  const refund = bodies.find(([p]) => p === "/refund-policy")[1];
  check("rules: the no-refund policy text is in place", /All sales are final/i.test(refund) && /No refunds/i.test(bodies.find(([p]) => p === "/premium")[1]));
  check("rules: the home page promises 3 free unlocks a day, not 'everything free forever'", /course unlocks every day/.test(home) && !/Every course on this platform is free/.test(home));
}

async function visits(browser) {
  // The visitor chart counts real page views (and ignores crawlers).
  const before = (await q(`select coalesce(sum(views),0)::int v, count(*)::int n from site_visits`))[0];
  // A fresh address each run, so this visitor has not been counted today.
  const ip = `10.91.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
  const ctx = await newDevice(browser, "chromium", "phone-large", { ip });
  const page = await ctx.newPage();
  await page.goto("/");
  await sleep(3500);
  await page.goto("/courses");
  await sleep(3500);
  await ctx.close();
  await fetch(`${BASE}/api/visit`, { method: "POST", headers: { "user-agent": "Googlebot/2.1", origin: BASE, "cf-connecting-ip": "10.90.7.8" } });
  const after = (await q(`select coalesce(sum(views),0)::int v, count(*)::int n from site_visits`))[0];
  check("visitor chart: two page views by one visitor are counted as 1 visitor, 2 views; a crawler is not counted", after.n - before.n === 1 && after.v - before.v === 2, `${JSON.stringify(before)} → ${JSON.stringify(after)}`);
}

async function noScript(browser) {
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, baseURL: BASE });
  const page = await ctx.newPage();
  await page.goto("/");
  const state = await page.locator("h1").evaluate((h) => ({ h1: getComputedStyle(h).opacity, cards: document.querySelectorAll("article").length }));
  check("without JavaScript: the home page content is visible", Number(state.h1) > 0.9 && state.cards > 0, JSON.stringify(state));
  await page.locator("#hero-search").fill("a");
  await page.locator("#hero-search").press("Enter");
  await page.waitForURL(/\/courses\?q=a/);
  check("without JavaScript: search still works (plain form)", (await page.locator("article").count()) > 0);
  // Course pages are complete in the first response (the download gate itself
  // needs JavaScript in any case).
  await page.goto(`/courses/${course.slug}`);
  const h1 = (await page.locator("h1").first().textContent().catch(() => "")) ?? "";
  check("without JavaScript: a course page shows its content", h1.trim() === course.title.trim() && (await page.locator('a[href^="/download/"]').count()) > 0, h1);
  await ctx.close();
}

/** A missing course: real 404 status, and the custom page with its search box. */
async function missingCourse(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, baseURL: BASE });
  const page = await ctx.newPage();
  const res = await page.goto("/courses/this-course-does-not-exist");
  check("missing course: HTTP 404 in the browser", res.status() === 404, res.status());
  const box = page.locator('input[name="q"]');
  check("missing course: the custom page with its search box is shown", (await seen(page.getByText("took a day off"))) && (await seen(box)));
  await box.fill("python");
  await box.press("Enter");
  await page.waitForURL(/\/courses\?q=python/, { timeout: 15_000 }).catch(() => {});
  check("missing course: searching from the 404 page opens the course list", /\/courses\?q=python/.test(page.url()), page.url());
  await ctx.close();
}

// Hero motion rules: CSS light everywhere, the video only on a desktop with
// no reduced-motion / data-saver signal, and never requested on a phone.
async function heroMotion(browser) {
  const run = async (label, options) => {
    const ctx = await browser.newContext({ baseURL: BASE, ...options });
    const page = await ctx.newPage();
    const heroRequests = [];
    page.on("request", (r) => /\/hero\//.test(new URL(r.url()).pathname) && heroRequests.push(r.url()));
    await page.goto("/", { waitUntil: "load" });
    await hydrated(page);
    await sleep(6000); // the video waits for load + an idle period (up to 4 s)
    const state = await page.evaluate(() => ({
      aurora: document.querySelectorAll(".hero-aurora > i").length,
      animation: getComputedStyle(document.querySelector(".hero-aurora > i")).animationName,
      video: document.querySelector("video.hero-video"),
      attrs: (() => {
        const v = document.querySelector("video.hero-video");
        return v ? { muted: v.muted, inline: v.playsInline, poster: v.getAttribute("poster"), preload: v.getAttribute("preload"), hidden: v.getAttribute("aria-hidden") } : null;
      })(),
    }));
    await ctx.close();
    return { label, heroRequests, ...state };
  };
  const phone = await run("phone", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  check("hero: the CSS light is on the phone hero and animates", phone.aurora === 3 && /^aurora-/.test(phone.animation), JSON.stringify(phone));
  check("hero: a phone never requests the video or its poster", phone.heroRequests.length === 0 && !phone.attrs, phone.heroRequests.join(","));
  const calm = await run("reduced motion", { viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  check("hero: reduced motion gets no video", calm.heroRequests.length === 0 && !calm.attrs, calm.heroRequests.join(","));
  const desktop = await run("desktop", { viewport: { width: 1440, height: 900 } });
  check("hero: a desktop gets the video after load, muted, inline, with a poster", !!desktop.attrs && desktop.attrs.muted && desktop.attrs.inline && !!desktop.attrs.poster && desktop.attrs.preload === "none" && desktop.attrs.hidden === "true", JSON.stringify(desktop.attrs));
}

for (const engine of engineNames()) {
  const browser = await launch(engine);
  for (const [name, fn] of [["theme", theme], ["motion", motion], ["saved", library], ["search", search], ["keyboard", keyboard]]) {
    await fn(engine, browser).catch((e) => check(`${engine} ${name}: ran to the end`, false, e.stack));
  }
  if (engine === "chromium") {
    await visits(browser).catch((e) => check("visit counting ran", false, e.stack));
    await noScript(browser).catch((e) => check("no-JavaScript checks ran", false, e.stack));
    await missingCourse(browser).catch((e) => check("missing-course checks ran", false, e.stack));
    await heroMotion(browser).catch((e) => check("hero-motion checks ran", false, e.stack));
  }
  await browser.close();
}
await seoAndRules().catch((e) => check("SEO and rule checks ran", false, e.stack));
await prisma.$disconnect();
process.exit(finish("ux") ? 1 : 0);
