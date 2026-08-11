#!/usr/bin/env bash
#
# Zero-downtime blue/green deploy for Courses Monster.
#
# BACKGROUND
# ----------
# The original procedure ran, inside the live app directory:
#
#     cd /opt/coursevault && rm -rf .next && npm run build
#     ... assemble ... && systemctl restart coursevault
#
# The old server kept serving during that build. Next.js loads route chunks from
# disk lazily, so for the whole build window any request for a route whose chunk
# was not already resident 500'd with:
#
#     Error: Failed to load chunk server/chunks/ssr/<hash>.js from module <id>
#     [cause]: Cannot find module '/opt/coursevault/.next/server/chunks/ssr/<hash>.js'
#
# which rendered the global error boundary. Admin pages suffered worst: they are
# all `force-dynamic` and rarely visited, so their chunks are almost never warm.
#
# HOW THIS WORKS NOW
# ------------------
# Two slots, blue (:3001) and green (:3002), each a systemd instance of
# coursevault@.service running from /opt/coursevault/releases/<slot>/standalone.
# nginx points at exactly one via /etc/nginx/conf.d/coursevault-upstream.conf.
#
# A deploy builds into the IDLE slot while the live slot keeps serving, starts
# it, health-checks it on its own port, then flips nginx with a graceful reload
# (`nginx -s reload` finishes in-flight requests on the old worker). No restart
# of the serving process, so no dropped requests.
#
# Rollback is trivial: if the new slot fails its health check it is simply
# stopped and nginx is never repointed — live traffic never touched it.
#
# Usage:  sudo bash scripts/deploy.sh
set -euo pipefail

SRC=${SRC:-/root/bot10}
APP=${APP:-/opt/coursevault}
RELEASES="$APP/releases"
STAGE=${STAGE:-/opt/coursevault-stage}
UPSTREAM_CONF=${UPSTREAM_CONF:-/etc/nginx/conf.d/coursevault-upstream.conf}
RSYNC_EXCLUDES=(--exclude=.git --exclude=.next --exclude=releases --exclude=uploads --exclude=node_modules --exclude=.env)
declare -A SLOT_PORT=([blue]=3001 [green]=3002)

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mDEPLOY FAILED: %s\033[0m\n' "$*" >&2; exit 1; }

[ -d "$SRC" ] || fail "source dir $SRC not found"
[ -d "$APP" ] || fail "app dir $APP not found"

# ---- which slot is live? ------------------------------------------------
CURRENT_PORT=$(grep -oP 'server 127\.0\.0\.1:\K[0-9]+' "$UPSTREAM_CONF" | head -1 || true)
[ -n "$CURRENT_PORT" ] || fail "could not read the active port from $UPSTREAM_CONF"
case "$CURRENT_PORT" in
  3001) LIVE=blue;  TARGET=green ;;
  3002) LIVE=green; TARGET=blue  ;;
  *) fail "unexpected active port $CURRENT_PORT in $UPSTREAM_CONF" ;;
esac
TARGET_PORT=${SLOT_PORT[$TARGET]}
log "Live slot: $LIVE (:$CURRENT_PORT).  Deploying into: $TARGET (:$TARGET_PORT)"

log "1/9 Backing up database + uploads"
bash /usr/local/bin/coursevault-backup.sh

log "2/9 Syncing source into $APP (runtime unaffected: it runs from releases/$LIVE)"
rsync -a --delete "${RSYNC_EXCLUDES[@]}" "$SRC"/ "$APP"/

cd "$APP"
set -a; source "$APP/.env"; set +a

log "3/9 Installing dependencies if the lockfile changed"
if ! cmp -s "$APP/package-lock.json" "$APP/.package-lock.deployed" 2>/dev/null; then
  npm install --no-audit --no-fund
  cp "$APP/package-lock.json" "$APP/.package-lock.deployed"
else
  echo "    lockfile unchanged - skipping npm install"
fi

log "4/9 Applying database migrations (additive only)"
npx prisma migrate deploy
npx prisma generate

log "5/9 Building in $STAGE (live slot keeps serving throughout)"
rm -rf "${STAGE:?}"
mkdir -p "$STAGE"
rsync -a --delete "${RSYNC_EXCLUDES[@]}" "$SRC"/ "$STAGE"/
cp "$APP/.env" "$STAGE/.env"
# Hard links: instant and no extra disk. Turbopack rejects a *symlinked*
# node_modules ("points out of the filesystem root"), so it must be a real tree.
cp -al "$APP/node_modules" "$STAGE/node_modules"
( cd "$STAGE" && set -a && source .env && set +a && npm run build )

log "6/9 Assembling the standalone bundle"
cd "$STAGE"
cp -r .next/static .next/standalone/.next/static

# Carry the outgoing build's static assets forward.
#
# Every build produces new content-hashed chunk names, and only ~60% of them
# collide with the previous build. A browser tab opened before the cutover — or
# any cached HTML document — still references the *old* hashes, and the old slot
# is deleted on the next deploy. Those requests then 404: the page returns 200
# but its JS/CSS is missing, so it "opens but not properly". Measured in the
# production access log: 55 such /_next/static 404s, clustered in the hours this
# was deployed repeatedly, for chunks present in neither slot.
#
# -n never overwrites, so the new build always wins on a collision; this only
# adds back hashes the new build does not have. Cheap (a few MB) and bounded:
# each deploy carries forward one generation, so it does not grow without limit.
if [ -d "$RELEASES/$LIVE/standalone/.next/static" ]; then
  cp -rn "$RELEASES/$LIVE/standalone/.next/static/." \
         .next/standalone/.next/static/ 2>/dev/null || true
  echo "    carried forward $(find "$RELEASES/$LIVE/standalone/.next/static" -type f | wc -l) assets from the $LIVE slot"
fi

cp -r public .next/standalone/public
cp .env .next/standalone/.env
mkdir -p .next/standalone/.next/cache

log "7/9 Verifying the admin path never leaked into a shared client bundle"
SEGMENT=$(grep -oP '^\s*"\K[a-zA-Z0-9]{40,}' "$APP/src/lib/admin-path.ts" | head -1 || true)
if [ -n "$SEGMENT" ]; then
  if find .next/static -name '*clientMiddlewareManifest*' -exec grep -l "$SEGMENT" {} \; 2>/dev/null | grep -q .; then
    fail "admin segment leaked into the client middleware manifest"
  fi
  echo "    ok - segment absent from the middleware manifest"
else
  echo "    WARNING: could not read ADMIN_SEGMENT - skipping leak check"
fi

log "8/9 Installing into the $TARGET slot and starting it"
systemctl stop "coursevault@$TARGET" 2>/dev/null || true
rm -rf "${RELEASES:?}/$TARGET"
mkdir -p "$RELEASES"
mv "$STAGE/.next" "$RELEASES/$TARGET"
printf 'PORT=%s\n' "$TARGET_PORT" > "$RELEASES/$TARGET/slot.env"
mkdir -p "$RELEASES/$TARGET/standalone/.next/cache"
chown -R coursevault:coursevault "$RELEASES/$TARGET"
systemctl start "coursevault@$TARGET"

echo "    health-checking $TARGET on :$TARGET_PORT (live traffic still on $LIVE)"
ok=0
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$TARGET_PORT/" || true)
  if [ "$code" = "200" ]; then ok=1; echo "    $TARGET healthy after ${i}s"; break; fi
  sleep 1
done
if [ "$ok" != "1" ]; then
  systemctl stop "coursevault@$TARGET" || true
  fail "new slot failed its health check - nginx was never repointed, $LIVE is still serving normally"
fi

# Next.js loads each route's server chunk from disk on first hit, so a slot that
# has only ever served "/" makes the first visitor of every other route pay the
# compile+load cost. Measured on a fresh slot: /api/auth/session took 3.5s cold
# and 0.09s warm, and the session call is mounted on every page. Warm the routes
# here, while the old slot is still the one taking traffic.
echo "    warming $TARGET before the cutover"
for path in / /courses /coding-channels /learn /apps /requests /chat /how-to-download \
            /api/auth/session /login /sitemap.xml; do
  curl -s -o /dev/null --max-time 30 "http://127.0.0.1:$TARGET_PORT$path" || true
done
echo "    warm-up done"

log "9/9 Switching nginx to $TARGET (graceful reload) and retiring $LIVE"
cat > "$UPSTREAM_CONF" <<CONF
# Active CourseVault slot — REWRITTEN BY scripts/deploy.sh, do not hand-edit.
# blue=3001, green=3002. Exactly one is live; the other is the idle slot a
# deploy builds into before nginx is gracefully reloaded onto it.
upstream coursevault_app {
    server 127.0.0.1:$TARGET_PORT;   # slot: $TARGET
    keepalive 32;
}
CONF
if ! nginx -t 2>/dev/null; then
  # Put the old upstream back before bailing out.
  sed -i "s/127\.0\.0\.1:$TARGET_PORT/127.0.0.1:$CURRENT_PORT/; s/# slot: $TARGET/# slot: $LIVE/" "$UPSTREAM_CONF"
  systemctl stop "coursevault@$TARGET" || true
  fail "nginx config test failed - reverted to $LIVE"
fi
systemctl reload nginx

# Let in-flight requests on the old worker finish before stopping that slot.
sleep 5
systemctl stop "coursevault@$LIVE" || true
systemctl enable "coursevault@$TARGET" >/dev/null 2>&1 || true
systemctl disable "coursevault@$LIVE" >/dev/null 2>&1 || true

log "Post-switch verification"
for path in / /courses /apps; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://courses.monster$path" || true)
  echo "    $code  $path"
  [ "$code" = "200" ] || fail "post-switch check failed for $path (roll back with: scripts/deploy.sh after repointing $UPSTREAM_CONF to :$CURRENT_PORT)"
done

rm -rf "${STAGE:?}"
log "Deploy complete — now serving from the $TARGET slot"
