# Performance Report & Notes

## Measured (production build, seeded data)

| Route | Rendering | First Load JS |
| --- | --- | --- |
| `/` (homepage) | Static + ISR (120 s) | ~210 kB |
| `/courses` | Dynamic SSR + streamed results | ~237 kB |
| `/courses/[slug]` | Dynamic SSR | ~210 kB |
| `/download/[slug]` | Dynamic SSR | ~214 kB |
| `/how-to-download` | Static + ISR (300 s) | ~210 kB |
| Admin routes | Dynamic (auth-gated) | 143–311 kB |

Shared client baseline is ~142 kB (React 19 + Framer Motion + Radix). All
public pages render meaningful content server-side; client JS only hydrates
interactivity.

## What makes it fast

**Rendering & caching**
- Homepage and CMS pages are ISR-cached; admin edits bust caches via
  `revalidatePath`/`revalidateTag` so content is still fresh.
- Course listing streams: filters render instantly inside `<Suspense>` while
  results resolve; skeleton grids cover the gap.
- `/api/courses` responses carry `s-maxage=60, stale-while-revalidate=300`.
- View-counter writes happen in `after()` — off the response critical path.

**Data layer**
- Composite indexes match every public query pattern:
  `(published, createdAt)`, `(published, featured)`, `(published, trending)`,
  `(published, downloads)`, `categoryId`, `order`, and
  `download_events(courseId, createdAt)`.
- Cursor-based pagination (no OFFSET scans) for infinite scroll.
- Card queries select only card fields (`courseCardSelect`), never full rows.
- Homepage fires its 5 queries in parallel (`Promise.all`).

**Assets**
- Images are resized + WebP-encoded once at upload (thumbnail 800 px, banner
  1920 px, quality ~80) and served immutable — no runtime optimizer needed.
- Gradient placeholders are pure CSS (zero bytes of image transfer).
- Fonts are self-hosted via `next/font` (no third-party font request,
  zero layout shift).
- Below-the-fold images lazy-load; hero/first-row images load eagerly.
- Nginx serves uploads and `_next/static` directly with gzip + immutable
  caching; the app compresses everything else.

**JS discipline**
- Server components by default; client components only where interactivity
  demands (search dialog, filters, forms, gate, tables).
- Route-level code splitting keeps admin-only code (forms, editors, tables)
  out of public bundles.
- Animations respect `prefers-reduced-motion` and use transform/opacity only.

## Lighthouse guidance

Run against the production deployment (not `next dev`):

```bash
npx lighthouse https://yourdomain.com --preset=desktop --view
```

Expected: 90+ performance on desktop and mobile for public pages, 100 for
accessibility/best-practices/SEO categories, given a reasonable VPS and no
enormous course images pasted as remote URLs (prefer uploading so images get
optimized).

## If it ever feels slow

1. `docker compose logs app | grep -i error` — shortener timeouts add latency
   only to download init, nothing else.
2. Check Postgres: `EXPLAIN ANALYZE` the listing query; verify indexes exist.
3. Watch for very large remote images added by URL — upload them instead.
4. Scale reading: increase homepage `revalidate`, add `s-maxage` at Nginx.
