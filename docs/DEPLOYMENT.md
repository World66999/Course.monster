# Deployment Guide

Target: a Linux VPS (Ubuntu 22.04/24.04) with your own domain, running the app in
Docker behind Nginx with Let's Encrypt TLS. Everything below is copy-pasteable;
replace `yourdomain.com` throughout.

## 0. What you need before starting

| Item | Where it goes |
| --- | --- |
| Domain name, DNS A record → VPS IP | Nginx + `NEXT_PUBLIC_SITE_URL` |
| VPS with ≥1 GB RAM, Docker installed | everything |
| Cloudflare Turnstile site + secret key (free) | `.env` |
| vplink.in API key | `.env` (optional but recommended) |
| Telegram channel link, logo, analytics ID | Admin → Settings (after deploy) |

## 1. Prepare the VPS

```bash
sudo apt update && sudo apt -y upgrade
# Docker
curl -fsSL https://get.docker.com | sh
# Nginx + certbot
sudo apt -y install nginx certbot python3-certbot-nginx
# Firewall
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

## 2. Get the code onto the server

```bash
sudo mkdir -p /opt/coursevault && sudo chown $USER /opt/coursevault
cd /opt/coursevault
git clone <your-repo-url> .        # or rsync/scp the project directory
```

## 3. Configure environment

```bash
cp .env.example .env
nano .env
```

Set at minimum:

```ini
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
AUTH_SECRET=<openssl rand -base64 32>
DOWNLOAD_TOKEN_SECRET=<openssl rand -base64 32>   # different value!
ADMIN_EMAIL=you@yourdomain.com
ADMIN_PASSWORD=<strong password>
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<from Cloudflare>
TURNSTILE_SECRET_KEY=<from Cloudflare>
VPLINK_API_KEY=<from vplink.in>
```

Add one extra variable used only by docker-compose:

```ini
POSTGRES_PASSWORD=<openssl rand -hex 16>
```

`DATABASE_URL` is composed automatically inside docker-compose from
`POSTGRES_PASSWORD` — you don't need to set it for Docker deploys.

## 4. Build and start

```bash
docker compose up -d --build
docker compose logs -f app     # wait for "Ready"; migrations run automatically
docker compose exec app node_modules/.bin/prisma db seed   # first deploy only
```

The app now listens on `127.0.0.1:3000` (not exposed publicly).

## 5. Nginx + SSL

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/coursevault
sudo sed -i 's/yourdomain.com/YOURREALDOMAIN/g' /etc/nginx/sites-available/coursevault
sudo ln -s /etc/nginx/sites-available/coursevault /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot auto-renews via systemd timer; verify with `sudo certbot renew --dry-run`.

### Serving uploads directly from Nginx (optional, faster)

The compose file stores uploads in a named volume. To let Nginx serve them
directly, bind-mount instead — in `docker-compose.yml` replace the `uploads:`
volume on the app service with:

```yaml
    volumes:
      - /var/lib/coursevault/uploads:/app/uploads
```

then `sudo mkdir -p /var/lib/coursevault/uploads && sudo chown 1001:1001 /var/lib/coursevault/uploads`
and `docker compose up -d`. The provided Nginx config already points there and
falls back to the app if a file isn't found.

## 6. First login & content

1. Visit `https://yourdomain.com/<ADMIN_SEGMENT>/login` — the segment is the constant
   exported from `src/lib/admin-path.ts` — and sign in with `ADMIN_EMAIL` /
   `ADMIN_PASSWORD`. There is nothing at `/admin`.
2. **Settings**: set site name, logo, favicon, Telegram link, social links, SEO
   defaults and analytics ID.
3. **Courses**: delete/replace the seeded sample courses with your own.
4. **Pages**: adjust the How-to-Download guide.
5. Change the admin password (see [MAINTENANCE.md](MAINTENANCE.md)).

## 7. Deploying updates

```bash
cd /opt/coursevault
git pull
docker compose up -d --build      # rebuilds, re-runs migrations, restarts
```

## Running without Docker (alternative)

Requires Node 20+, PostgreSQL 16 and a process manager:

```bash
npm ci && npm run build
npx prisma migrate deploy && npx prisma db seed
# systemd or pm2:
pm2 start "node .next/standalone/server.js" --name coursevault
```

Note: with `output: "standalone"` you must run `node .next/standalone/server.js`
(not `next start`), and copy `.next/static` → `.next/standalone/.next/static`
plus `public` → `.next/standalone/public` after each build.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| 502 from Nginx | `docker compose logs app` — app crashed or still starting |
| Login redirects in a loop | `AUTH_TRUST_HOST=true` missing, or Nginx not sending `X-Forwarded-Proto` |
| Captcha never loads | Turnstile site key wrong, or domain not added to the widget |
| Downloads skip the shortener | `VPLINK_API_KEY` empty or vplink API failing — check `docker compose logs app | grep shortener` |
| Wrong URLs in sitemap/OG tags | `NEXT_PUBLIC_SITE_URL` wrong (rebuild required after change) |
