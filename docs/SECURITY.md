# Security Documentation

This document describes the security model, what each layer protects against,
and the operational checklist. The app follows industry best practices; no
system is 100% secure — report issues promptly and keep dependencies updated.

## Authentication & authorization

- **Auth.js v5 credentials provider.** Passwords hashed with bcrypt (cost 12).
  A dummy hash comparison runs even for unknown emails to reduce user
  enumeration via timing.
- **Brute-force protection.** Login attempts are rate-limited per email
  (10 / 15 min) *and* per IP (15 / 15 min). Failed attempts are audit-logged.
- **Sessions** are JWTs in HTTP-only, SameSite=Lax cookies (Secure over
  HTTPS), max age 12 h.
- **Two guards on every admin surface:** middleware blocks the admin segment,
  and every server action / admin API independently calls `requireAdmin()` —
  a compromised or bypassed middleware still leaves mutations protected.

## Input validation & injection

- Every request body, query string, form and setting passes a **Zod schema**
  before use; unknown fields are stripped.
- **SQL injection:** all database access goes through Prisma's parameterized
  query engine — no raw SQL anywhere in the codebase.
- **XSS:** React escapes output by default; markdown is rendered with
  react-markdown, which never injects raw HTML (embedded HTML renders as inert
  text). The strict CSP is a second net.
- **CSRF:** admin mutations are Next.js server actions (built-in origin/host
  verification); the Auth.js login flow carries its own CSRF token; public
  POST endpoints (newsletter, download init) are same-origin-enforced by CSP
  `form-action`/`connect-src` and are harmless + rate-limited besides.
- **Path traversal:** upload serving resolves only `[a-zA-Z0-9._-]` filenames
  inside `UPLOAD_DIR` and rejects anything that escapes it.
- **File uploads:** admin-only, 8 MB cap, MIME allowlist, decoded and
  re-encoded by sharp (a file that isn't a real image fails processing),
  pixel-bomb limit, randomized file names.

## Download flow protections

- Cloudflare **Turnstile** verified server-side on every download init.
- Per-IP rate limits: 10 inits / 5 min, 20 redirects / 5 min.
- `/go` tokens: HMAC-SHA256 signed (constant-time compare), bound to the
  requester's hashed IP, 90-second expiry, single-use nonce.
- The vplink **API key never leaves the server** (`server-only` import guard);
  the short URL is only ever emitted as a 302 `Location` header with
  `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex`.
- These measures stop casual link sharing and bots; a determined user can
  always observe their own browser's redirect — that is inherent to any
  client-reachable URL.

## HTTP hardening

Set globally in `next.config.ts` (and HSTS in Nginx):

- Strict `Content-Security-Policy` (self + Turnstile + GA only, `object-src
  'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`)
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, restrictive
  `Permissions-Policy`, `Strict-Transport-Security` (Nginx), no
  `X-Powered-By`.

## Where the client IP comes from — and what it rests on

Every IP rate limit in the app (download init, `/go`, the verification
challenge, the social downloader, the newsletter) is keyed on the address
`src/lib/ip.ts` resolves, and that comes from a request header: `CF-Connecting-IP`
first, then `Forwarded`, `X-Forwarded-For`, `X-Real-IP`. A self-hosted Next.js
process cannot see the TCP peer, so it has no way to tell a header Cloudflare set
from one a client typed.

**The firewall, not the application, is what makes those headers trustworthy.**
Ports 80 and 443 must be open only to Cloudflare's published ranges. Measured
against the running app: 40 requests carrying one forged `CF-Connecting-IP` hit
the limit and were refused, and 40 requests each carrying a *different* forged
value all succeeded — so an attacker who can reach the origin directly has no
rate limit at all. Nothing in the code can detect this; it is a network fact.

- `scripts/check-cloudflare-allowlist.sh` compares the live ufw rules against
  Cloudflare's published list and fails if 80/443 are open to anything else.
  It is on the monthly checklist in MAINTENANCE.md, because Cloudflare's ranges
  change and a rebuilt firewall can silently drop the rules.
- `deploy/nginx.conf` additionally overwrites all four headers on the way
  through, and documents the `real_ip` block to use when Cloudflare is in front,
  so a forged value cannot survive even if it reaches nginx.

## Privacy & audit

- Client IPs are **never stored raw** — download events and rate-limit keys
  use salted SHA-256 hashes.
- Every admin mutation and failed login lands in the `audit_logs` table with
  actor, action, entity and timestamp.

## Secrets management

- All secrets live in `.env` (git-ignored); `.env.example` documents them.
- `AUTH_SECRET` and `DOWNLOAD_TOKEN_SECRET` must be distinct 32-byte random
  values.
- Server-only modules (`shortener`, `settings`, `uploads`, …) import
  `server-only`, making accidental client bundling a build error.

## Operational checklist

- [ ] Strong, unique `ADMIN_PASSWORD`; change it after first login
- [ ] `AUTH_SECRET` / `DOWNLOAD_TOKEN_SECRET` generated with `openssl rand`
- [ ] HTTPS enforced with auto-renewing certificates
- [ ] Real Turnstile keys (test keys accept everything!)
- [ ] `ufw` allowing only 22/80/443; app port bound to 127.0.0.1
- [ ] Postgres not exposed publicly (compose maps no public port)
- [ ] Backups configured and restore-tested (see BACKUP_RESTORE.md)
- [ ] `npm audit` reviewed on every upgrade cycle
