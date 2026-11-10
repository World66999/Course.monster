# Redesign & upgrade plan — 2026-11-10

Branch: `redesign/2026-11-10` (from `audit/2026-08-25-full-repair`, one commit ahead of `main`).

## 1. What the project is

| Area | Detail |
| --- | --- |
| Stack | Next.js 15.5 (App Router, `output: standalone`, Turbopack), React 19, TypeScript, Tailwind CSS v4, Prisma 6 + PostgreSQL, Auth.js v5 |
| Public site | `src/app/(site)` — home, courses, course page, download gate, Premium, checkout, directories (apps, AI platforms, free resources, coding channels, learn), legal pages |
| Admin panel | `src/app/<secret segment>/(panel)` — 23 sections, staff-only (middleware + `requireAdmin()` on every action) |
| Telegram bot | Webhook route `src/app/api/telegram/webhook/[segment]`, logic in `src/lib/telegram/*`; shares the database with the site, hands users to `/download/<slug>?src=<signed token>` |
| Payments | Razorpay (UPI/card, `src/lib/razorpay*.ts`, webhook `/api/payments/razorpay/webhook`) and NOWPayments (crypto, `src/lib/nowpayments.ts`, IPN `/api/payments/nowpayments/ipn`). Premium truth = `User.premiumUntil` |
| Free unlocks | `src/lib/free-unlocks.ts`: 3 per IST day, VPLink → GPLinks → LinkShortify, anonymous per-device cookie `cv_ub`, verified return at `/unlock/[token]` |
| Deploy | `scripts/deploy.sh`: blue/green systemd slots (`coursevault@blue` :3001, `@green` :3002) behind nginx + Cloudflare; additive Prisma migrations run before the build |
| Tests | 23 unit-test files (`npm test`, no DB/network). Browser tests existed only as ad-hoc scripts outside the repo |

### Pages and flows

- **Free visitor (anonymous):** Home → Courses (search, filters, sort, infinite scroll) → Course page → `/download/<slug>` (countdown → human check → shortener → `/unlock/<token>` → file). Counter shows unlocks used today.
- **Telegram user:** bot message → course link with attribution token → same download page, counted against the Telegram id.
- **Premium buyer:** `/premium` → sign in → `/premium/checkout` (Razorpay tab or crypto tab) → webhook/IPN activates → `/premium/success`. Members skip the gate (`/go/<direct token>`), see Premium Resources and Telegram groups, open priority tickets.
- **Admin:** secret login → dashboard, courses CRUD (bulk, reorder), categories, moderation, users, payments (NOWPayments + Razorpay pages), premium content, support inbox, Telegram bot, settings.

## 2. Audit findings (measured on a local production build against a copy of the database)

Baseline browser sweep (Chromium, phone + desktop, light + dark): **457 checks passed, 0 failed** — no console errors, no failed requests, no broken images or links (185 internal links), no sideways scrolling. So the site is functionally healthy; the problems are speed, a few visual bugs and missing features.

### Performance (Lighthouse mobile, before)

| Page | Perf | A11y | Best practices | SEO | LCP | TBT |
| --- | --- | --- | --- | --- | --- | --- |
| Home | 64 | 100 | 100 | 100 | 4.2 s | 950 ms |
| Courses | 68 | 100 | 100 | 100 | 4.0 s | 770 ms |
| Course page | 66 | 100 | 100 | 100 | 4.4 s | 770 ms |
| Premium | 77 | 100 | 100 | 100 | 3.8 s | 440 ms |
| Download | 62 | 100 | 100 | 66 (noindex, intended) | 4.0 s | 1400 ms |

Causes found with a CPU-throttled trace of the home page:

1. **Theme library (`next-themes`) restyles the whole page three times on every load** — it removes and re-adds the theme class and injects/removes a "no transitions" stylesheet on mount. ~700 ms of main-thread time on a throttled phone.
2. **Scroll-reveal marks elements after hydration and writes inherited custom properties (`--i`) on every staggered child**, forcing a second wide style recalculation (~785 elements). Each `Reveal`/`Stagger`/`Spotlight` is also its own hydrated client component.
3. **Radix dropdown code (≈70 kB) is in every page's first load** for the desktop nav and user menu, even on phones where they are hidden.
4. **Three font families are preloaded**, including the monospace face that almost nothing above the fold uses.
5. Only gzip at the origin (Cloudflare adds Brotli at the edge), and no `browserslist` — CSS/JS targets were implicit.

### Bugs and rough edges

- Home category arrow has a mangled class (`sm:block-[opacity,translate,color]`) so the hover arrow never shows.
- Home hero leaves a large empty gap under the stats card on phones.
- Course page on phones shows the course image twice (banner, then the sidebar card) before the download button.
- Home copy says "No paywalls… every course is free, forever" while Premium courses exist — contradictory.
- Most categories have no icon, so the category grid is a wall of identical book icons.
- Admin sidebar is a flat list of 23 links; dashboard has one chart (downloads) and nothing about unlocks, Premium sales or revenue.
- Admin course reorder is up/down buttons only; filters are status-only.
- Payments are split across two admin pages with no combined view; no subscription list.
- No web app manifest/icons (not installable), no "saved" or "recently viewed" courses, the free-unlock counter is only visible on the download page.
- `deploy.sh` warms `/requests` and `/chat`, which no longer exist (harmless 404s).
- One unused component: `src/components/site/requests/status-badge.tsx`.
- Browser tests are not in the repo.

### Compatibility risks

- Devanagari (Hindi) text has no explicit fallback fonts in the stack.
- `min-h-dvh` has no `vh` fallback for browsers before `dvh` (iOS < 15.4, old WebViews).
- Glass/blur was removed entirely for speed; the brief asks for light use with fallbacks.
- No automatic reduction of effects on low-end devices or data-saver connections.

## 3. Rules for this work

- No change to payment, webhook, Premium-activation, free-unlock or bot logic. New code may *read* those tables for display only.
- No sign-in for free users; no community-group link; no on-site chat; Telegram stays the only public contact; ₹100 = $1; no-refund text stays.
- `.env` is never printed, edited or committed.
- Database changes are additive only (one new table for visit counts).
- Everything is verified on a local build against a throwaway database before the live deploy.

## 4. Plan

### Step 1 — Foundation: design tokens, speed, compatibility
- Tokens in `globals.css` stay the single source (colour, type scale, radius, shadows, motion); add z-index/duration tokens, fallback fonts for Hindi, `vh` fallbacks, light glass behind `@supports` with opaque fallback.
- Replace `next-themes` with a small built-in theme script + hook (no restyle on load); keep dark as default and the toggle.
- Rebuild scroll reveal as one shared controller with CSS-only stagger; one delegated pointer glow.
- Replace Radix dropdowns in the header with a light menu component.
- Low-end/data-saver detection → `data-perf="low"` switches off decorative motion.
- `browserslist` in `package.json`; stop preloading the mono font.

### Step 2 — Public site redesign and features
- Home: tighter hero, quick category chips, "how it works", Free vs Premium comparison, recently viewed rail, honest copy.
- Course cards: save button, clearer Free/Premium label. Course page: no duplicate image on phones, save/share, free-unlock counter.
- "Saved" and "Recently viewed" (browser storage only) with a `/saved` page.
- Free-unlock counter chip (read-only API using the existing device cookie).
- Custom 404/error polish, PWA manifest + icons, SEO additions.

### Step 3 — Admin
- Grouped sidebar, mobile-friendly tables.
- Dashboard: visitors, unlocks, Premium sales, revenue by gateway (SVG charts, no chart library).
- Courses: category/type filters, drag-to-reorder (buttons kept for touch/keyboard).
- One payments view across both gateways with status filters, plus a subscription list.

### Step 4 — Tests and release
- Playwright suite in `tests/e2e` (Chromium, Firefox, WebKit; small phone → wide desktop; portrait/landscape; dark/light; reduced motion; free unlock, Premium purchase path, admin actions).
- Lighthouse before/after.
- Deploy with `scripts/deploy.sh`, confirm site and bot are live.
