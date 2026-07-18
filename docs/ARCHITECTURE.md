# Architecture & Project Structure

## Stack

- **Next.js 15 (App Router)** — SSR/ISR for public pages, server actions for
  admin mutations, route handlers for public APIs.
- **TypeScript (strict)**, **Tailwind CSS v4** (CSS-variable design tokens),
  **Framer Motion** (entrance/transition animations), **Radix UI** primitives.
- **Prisma + PostgreSQL 16** — typed data access, migrations in `prisma/migrations`.
- **Auth.js v5** — credentials provider, JWT sessions, edge-safe middleware config.
- **Zod 4** — single source of truth for every input schema (client + server).

## Directory layout

```
prisma/            schema, migrations, seed
deploy/nginx.conf  reverse-proxy config
docs/              this documentation
src/
  auth.ts          full Auth.js config (Node runtime: bcrypt + Prisma)
  auth.config.ts   edge-safe subset shared with middleware
  middleware.ts    protects /admin/*
  app/
    (site)/        public pages (share header/footer layout)
      page.tsx               homepage
      courses/               listing + [slug] detail
      download/[slug]/       protected download gate
      how-to-download/       CMS page
    admin/
      login/                 unauthenticated login screen
      (panel)/               authenticated admin (shared shell layout)
    api/
      auth/[...nextauth]/    Auth.js handlers
      courses/               public listing API (infinite scroll, search)
      download/init/         captcha verify + token issue
      newsletter/            signup endpoint
      admin/upload/          authenticated image upload
    go/[token]/    single-use server-side redirect to the short link
    uploads/[file]/ serves processed images from UPLOAD_DIR
    sitemap.ts, robots.txt/  SEO endpoints (DB/settings driven)
  components/
    ui/            design-system primitives (button, input, dialog, …)
    site/          public-site components (cards, header, filters, gate, …)
    admin/         admin components (tables, forms, editors, shell)
  lib/             framework-free domain logic
    db.ts          Prisma singleton
    settings*.ts   site settings schema + cached loader
    courses.ts     query layer for public course data
    shortener.ts   vplink client (server-only, cached, retried)
    download-token.ts  HMAC single-use tokens
    rate-limit.ts  sliding-window limiter
    captcha.ts     Turnstile verification
    uploads.ts     sharp processing + path safety
    audit.ts       audit logging
    validation.ts  zod schemas for forms/APIs
  server/
    auth-helpers.ts  requireAdmin() guard
    actions/         server actions (courses, categories, settings, pages, auth)
```

## Key design decisions

**Server actions for admin, route handlers for public.** Admin mutations use
server actions (automatic CSRF origin checks, no API surface to expose); the
public read API is a route handler so infinite scroll and the search dialog can
fetch JSON with HTTP caching.

**Settings as one validated JSON row.** All site-wide configuration is a single
`settings` row validated by `siteSettingsSchema`, loaded through
`unstable_cache` with tag invalidation. Adding a setting = add a field to the
schema + a form input; unknown/invalid stored data falls back to defaults.

**Download flow trust boundaries.** The client only ever receives
`/go/<token>`. The token is HMAC-signed, bound to the requester's hashed IP,
expires in 90 s and is single-use. The vplink short URL appears only in the
302 `Location` header. Short links are cached in the `short_links` table keyed
by a hash of the destination, so editing a download URL naturally produces a
new short link.

**Images.** Admin uploads are resized + converted to WebP by sharp at upload
time and served with immutable cache headers (by Nginx in production). This
replaces next/image's runtime optimizer, avoiding remote-domain allowlist
foot-guns while keeping payloads small. Missing artwork renders a
deterministic gradient placeholder — no broken images, ever.

**Rate limiting is in-process** (sliding window). Correct for the intended
single-node deployment; the limiter is isolated behind one function so a Redis
implementation can be swapped in for multi-node setups.

**Counters are denormalized.** `courses.downloads`/`views` are incremented
atomically for cheap sorting/display, while `download_events` keeps the
per-event history for the dashboard chart and future analytics.
