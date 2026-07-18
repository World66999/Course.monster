# Maintenance Guide

## Routine

| Cadence | Task |
| --- | --- |
| Daily (automated) | Backups (cron, see BACKUP_RESTORE.md) |
| Weekly | Skim `/admin/activity` for unexpected actions & failed logins |
| Weekly | `docker compose logs --since 168h app \| grep -E "error|shortener"` |
| Monthly | `npm audit` + dependency review (see UPGRADE.md) |
| Monthly | Test-restore the latest DB backup |
| Quarterly | Rotate the admin password |

## Health checks

```bash
docker compose ps                      # both services "running (healthy)"
curl -sI https://yourdomain.com | head -1        # HTTP/2 200
curl -s https://yourdomain.com/api/courses?limit=1 | head -c 80   # JSON
df -h /                                # disk not filling up
```

Optional uptime monitoring: point any monitor (UptimeRobot, etc.) at `/`.

## Managing the admin password

Change it by generating a new bcrypt hash and updating the row:

```bash
docker compose exec app node -e "
const bcrypt = require('bcryptjs');
bcrypt.hash(process.argv[1], 12).then(console.log);
" 'NEW_PASSWORD_HERE'
docker compose exec db psql -U freecourses -c \
  "UPDATE users SET \"passwordHash\"='<hash from above>' WHERE email='you@yourdomain.com';"
```

(Or update `ADMIN_PASSWORD` in `.env` and re-run the seed — it only touches a
missing admin user, so for an existing user the SQL route above is the one.)

## Adding another admin user

```bash
docker compose exec app node -e "
const bcrypt = require('bcryptjs');
bcrypt.hash('THEIR_PASSWORD', 12).then(h => console.log(h));
"
docker compose exec db psql -U freecourses -c \
  "INSERT INTO users (id, email, name, \"passwordHash\", role, \"createdAt\", \"updatedAt\")
   VALUES (gen_random_uuid()::text, 'them@example.com', 'Name', '<hash>', 'ADMIN', now(), now());"
```

## Data hygiene

- `download_events` grows one row per download. It is small (≈100 B/row), but
  if you ever want to trim: `DELETE FROM download_events WHERE "createdAt" < now() - interval '1 year';`
- `audit_logs` — same approach if it ever gets large.
- `short_links` — safe to truncate at any time; links regenerate on demand.

## Logs

- App: `docker compose logs app` (shortener failures, captcha errors, audit
  write failures all log with prefixes `[shortener]`, `[captcha]`, `[audit]`).
- Nginx: `/var/log/nginx/access.log`, `error.log` (logrotate handles rotation).

## Disk space

Uploads and Postgres are the growth areas. Check with:

```bash
docker system df
du -sh /var/lib/coursevault/uploads
```

`docker image prune -f` after upgrades reclaims old build layers.
