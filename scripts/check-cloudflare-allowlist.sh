#!/usr/bin/env bash
#
# Verifies that the origin is still reachable only through Cloudflare.
#
# WHY THIS MATTERS
# ----------------
# The app resolves a visitor's address from CF-Connecting-IP (src/lib/ip.ts) and
# keys every IP rate limit on the result: /api/download/init, /go/<token>, the
# verification challenge, the social downloader. It cannot see the TCP peer, so
# it has to take that header at face value.
#
# That is only safe while nothing but Cloudflare can open a connection to this
# machine on 80/443. Measured directly against the app: 40 requests from one
# forged CF-Connecting-IP hit the limit and were refused, and 40 requests each
# carrying a *different* forged value all succeeded. The firewall is what stands
# between those two results — not any check in the application.
#
# Cloudflare adds and retires ranges, and a rebuilt firewall can quietly lose
# the rules, so this is worth re-running rather than assuming.
#
# Usage: sudo bash scripts/check-cloudflare-allowlist.sh
set -euo pipefail

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

curl -fsS --max-time 20 https://www.cloudflare.com/ips-v4 > "$tmp/v4"
curl -fsS --max-time 20 https://www.cloudflare.com/ips-v6 > "$tmp/v6"
# Neither file is guaranteed to end in a newline.
{ cat "$tmp/v4"; echo; cat "$tmp/v6"; } | tr -d '\r' | sed '/^$/d' | sort -u > "$tmp/published"

ufw status | awk '$1 ~ /^(80|443)\/tcp/ { print $(NF-2) }' \
  | grep -E '^[0-9a-f:.]+/[0-9]+$' | sort -u > "$tmp/allowed"

status=0

if ! ufw status | grep -q "Status: active"; then
  echo "FAIL: ufw is not active — the origin is open to the internet."
  exit 1
fi

if ufw status | grep -qE '^(80|443)/tcp[[:space:]]+ALLOW[[:space:]]+Anywhere'; then
  echo "FAIL: 80/443 are open to Anywhere. CF-Connecting-IP can be forged by"
  echo "      connecting to the origin directly, which defeats every IP rate limit."
  status=1
fi

missing=$(comm -23 "$tmp/published" "$tmp/allowed" || true)
if [ -n "$missing" ]; then
  echo "WARN: Cloudflare publishes ranges the firewall does not allow — visitors"
  echo "      arriving through these will be refused at the packet level:"
  echo "$missing" | sed 's/^/        /'
  status=1
fi

stale=$(comm -13 "$tmp/published" "$tmp/allowed" || true)
if [ -n "$stale" ]; then
  echo "WARN: the firewall allows ranges Cloudflare no longer publishes. Not"
  echo "      dangerous on its own, but they should be retired:"
  echo "$stale" | sed 's/^/        /'
fi

if [ "$status" = 0 ] && [ -z "$stale" ]; then
  echo "OK: 80/443 are restricted to exactly Cloudflare's $(wc -l < "$tmp/published") published ranges."
fi
exit "$status"
