# Browser tests

Real-browser tests for the public site, the Premium purchase path, the free-unlock
flow, the Telegram bot hand-off and the admin panel. They run in **Chromium, Firefox
and WebKit** (the engine behind Safari and every iOS in-app browser, including
Telegram's) across phone, tablet, laptop, wide-desktop and 4K sizes, in portrait and
landscape, dark and light, and with reduced motion.

They never touch the live site. The test site runs on its own port with test-only
secrets (`env.sh`), a **throwaway database**, and one local mock server standing in
for Razorpay, NOWPayments, the three link shorteners and the Telegram API.

## One-time setup

```bash
cd tests/e2e
npm install
npx playwright install chromium firefox webkit      # browsers
sudo npx playwright install-deps webkit firefox     # system libraries (Linux)

# A throwaway Postgres with a copy of the data (never the live database):
docker run -d --name cvtest -e POSTGRES_PASSWORD=test -e POSTGRES_DB=freecourses -p 127.0.0.1:55432:5432 postgres:16
pg_restore --no-owner -d postgresql://postgres:test@127.0.0.1:55432/freecourses /path/to/backup.dump
```

## Run

```bash
export E2E_DATABASE_URL=postgresql://postgres:test@127.0.0.1:55432/freecourses
export E2E_UPLOAD_DIR=/path/to/a/copy/of/uploads     # optional: course images

DATABASE_URL=$E2E_DATABASE_URL npx prisma migrate deploy   # bring the copy up to date
tests/e2e/server.sh build     # production build with the test settings
tests/e2e/server.sh start     # mock services + test site on http://127.0.0.1:3999
tests/e2e/run.sh              # all suites, all three engines
tests/e2e/server.sh stop
```

`env.sh` refuses to run if `E2E_DATABASE_URL` is the database in the project's `.env`.

| Suite | What it covers |
| --- | --- |
| `sweep` | Every public, member and admin page in each engine and size: HTTP status, console errors, failed requests, broken images, sideways scrolling, content left hidden, 16px inputs and 44px tap targets on phones, every internal link |
| `flows` | Free unlock: VPLink → GPLinks → LinkShortify, the daily limit, free re-open, too-fast / other-browser / re-used links, Premium members, the bot hand-off in Telegram's browser, the unlock counter |
| `payments` | Razorpay and NOWPayments purchase to Premium activation, duplicate webhooks, forged signatures, wrong amounts, ₹100 = $1, the no-refund notice |
| `admin` | Sign-in, dashboard charts, course create / search / filter / bulk / reorder / edit / delete, payments and subscription filters, access control |
| `ux` | Theme toggle, reduced motion, low-end devices, saved and recently viewed, search, keyboard, SEO, installability, site rules, no-JavaScript |

Useful switches: `E2E_BROWSERS=chromium,webkit`, `E2E_VERBOSE=1` (print passing checks
too), `E2E_QUICK=1` (sweep: phones and public pages only). Results and screenshots are
written to `$E2E_OUT` (default `/tmp/coursevault-e2e-run/results`).
