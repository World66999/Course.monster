# Course.monster

# CourseVault — Free Courses Platform

A production-ready platform for browsing, searching and downloading free courses through a
protected, monetizable download flow. Built with Next.js 15, TypeScript, Tailwind CSS,
Prisma and PostgreSQL.

## Features

**Public site**
- Homepage with hero, stats, categories, featured / trending / recently-added sections
- Course listing with search, category & tag filters, sorting and infinite scroll
- Course pages with markdown descriptions, related courses, Telegram links and SEO
  (Open Graph, Twitter cards, `Course` + `BreadcrumbList` JSON-LD)
- Protected download flow: countdown → Cloudflare Turnstile captcha → server-generated
  vplink.in short link → single-use, IP-bound, 90-second redirect token
- Admin-editable "How to Download" page, custom 404, dark/light theme, ⌘K search,
  newsletter signup, full keyboard navigation and reduced-motion support

**Admin panel** (`/admin`)
- Dashboard with stats, 14-day download chart, popular courses and recent activity
- Course CRUD: create, edit, delete, duplicate, publish/unpublish, reorder,
  bulk select + bulk publish/unpublish/delete, image uploads (auto-WebP via sharp)
- Category management, markdown page editor, newsletter subscriber list, audit log
- Website settings: name, logo, favicon, announcement bar, Telegram & social links,
  SEO defaults, Google Analytics, robots.txt, default theme, download countdown —
  all without touching code

**Security**
- Auth.js v5 credentials login (bcrypt, rate-limited), JWT sessions, middleware +
  server-side guards on every admin action
- Zod validation on every input, CSRF-safe server actions, strict CSP and security
  headers, IP hashing, audit logging, single-use HMAC download tokens
- Shortener API key lives server-side only (`server-only` module)

## Quick start (development)

```bash
cp .env.example .env        # fill in DATABASE_URL, AUTH_SECRET, etc.
npm install
npx prisma migrate dev
npx prisma db seed          # admin user + sample content
npm run dev
```

- Site: http://localhost:3000 — Admin: http://localhost:3000/admin
- Admin login: the `ADMIN_EMAIL` / `ADMIN_PASSWORD` you set in `.env` before seeding.

## Documentation

| Doc | Contents |
| --- | --- |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Step-by-step VPS + Docker deployment, Nginx, SSL |
| [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md) | Using the admin panel |
| [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md) | Backups and disaster recovery |
| [docs/MAINTENANCE.md](docs/MAINTENANCE.md) | Routine maintenance and monitoring |
| [docs/UPGRADE.md](docs/UPGRADE.md) | Upgrading dependencies and the app |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Project structure and design decisions |
| [docs/SECURITY.md](docs/SECURITY.md) | Security model and hardening checklist |
| [docs/PERFORMANCE.md](docs/PERFORMANCE.md) | Performance report and optimization notes |

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server (Turbopack) |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` / `npm run typecheck` | ESLint / strict TypeScript checks |
| `npm run db:migrate:dev` | Create & apply a migration in development |
| `npm run db:migrate` | Apply migrations in production |
| `npm run db:seed` | Seed admin user, categories, sample courses |
| `npm run db:studio` | Prisma Studio database GUI |
