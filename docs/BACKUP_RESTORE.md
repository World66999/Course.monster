# Backup & Restore

Two things hold all your data:

1. **PostgreSQL database** — courses, categories, settings, pages, users,
   download stats, audit log, subscribers.
2. **Uploads directory** — images uploaded through the admin panel.

Everything else is reproducible from git.

## Backups

### Database

```bash
# Docker deploy
docker compose exec -T db pg_dump -U freecourses -Fc freecourses > backup-$(date +%F).dump

# Bare-metal deploy
pg_dump -U freecourses -Fc freecourses > backup-$(date +%F).dump
```

### Uploads

```bash
# Named volume
docker run --rm -v coursevault_uploads:/data -v "$PWD":/backup alpine \
  tar czf /backup/uploads-$(date +%F).tar.gz -C /data .

# Bind mount / bare metal
tar czf uploads-$(date +%F).tar.gz -C /var/lib/coursevault/uploads .
```

### Automate (daily, keep 14 days)

`sudo crontab -e`:

```cron
30 3 * * * cd /opt/coursevault && docker compose exec -T db pg_dump -U freecourses -Fc freecourses > /var/backups/coursevault/db-$(date +\%F).dump && find /var/backups/coursevault -name 'db-*.dump' -mtime +14 -delete
45 3 * * * tar czf /var/backups/coursevault/uploads-$(date +\%F).tar.gz -C /var/lib/coursevault/uploads . && find /var/backups/coursevault -name 'uploads-*.tar.gz' -mtime +14 -delete
```

Create the target dir first: `sudo mkdir -p /var/backups/coursevault`.
**Copy backups off the server** (object storage, another machine) — a backup on
the same disk is not a backup.

## Restore

### Database

```bash
# Docker: stop the app so nothing writes during restore
docker compose stop app
docker compose exec -T db pg_restore -U freecourses -d freecourses --clean --if-exists < backup-2026-07-18.dump
docker compose start app
```

### Uploads

```bash
# Named volume
docker run --rm -v coursevault_uploads:/data -v "$PWD":/backup alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/uploads-2026-07-18.tar.gz -C /data"

# Bind mount
sudo tar xzf uploads-2026-07-18.tar.gz -C /var/lib/coursevault/uploads
```

### Full disaster recovery (new server)

1. Follow [DEPLOYMENT.md](DEPLOYMENT.md) steps 1–4 (skip the seed).
2. Restore the database dump, then the uploads archive.
3. Point DNS at the new server, re-run certbot.
4. Verify: homepage, one course page, one download, admin login.

## Verify backups regularly

Once a month, restore the latest dump into a scratch database and check row
counts: `pg_restore --list backup.dump | head`. An untested backup is a hope,
not a plan.
