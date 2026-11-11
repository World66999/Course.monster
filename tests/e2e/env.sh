#!/usr/bin/env bash
# Environment for the browser-test server. Source it; do not execute it.
#
# Every value here is a TEST-ONLY dummy. Nothing is read from the project's
# real .env, so a test run cannot reach the live database, the real payment
# gateways, the real shorteners or the real Telegram API.
#
# Required before sourcing:
#   E2E_DATABASE_URL   a THROWAWAY Postgres database (tests insert and delete rows)
# Optional:
#   E2E_UPLOAD_DIR     folder with course images (defaults to an empty temp dir)
#   E2E_PORT           port for the test site (default 3999)
#   E2E_MOCK_PORT      port for the mock gateways (default 47000)

: "${E2E_DATABASE_URL:?Set E2E_DATABASE_URL to a throwaway database, never the live one}"

export E2E_PORT="${E2E_PORT:-3999}"
export E2E_MOCK_PORT="${E2E_MOCK_PORT:-47000}"
export E2E_BASE="http://127.0.0.1:${E2E_PORT}"
export E2E_MOCK="http://127.0.0.1:${E2E_MOCK_PORT}"
export E2E_UPLOAD_DIR="${E2E_UPLOAD_DIR:-/tmp/coursevault-e2e-uploads}"

# Refuse to run against the database the project's own .env points at.
E2E_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [ -f "$E2E_ROOT/.env" ]; then
  live_db="$(grep -E '^DATABASE_URL=' "$E2E_ROOT/.env" | head -1 | cut -d= -f2- | tr -d '"')"
  if [ -n "$live_db" ] && [ "$live_db" = "$E2E_DATABASE_URL" ]; then
    echo "E2E_DATABASE_URL is the same database as .env DATABASE_URL. Refusing to run." >&2
    return 1 2>/dev/null || exit 1
  fi
fi

export NODE_ENV=production
export PORT="$E2E_PORT" HOSTNAME=127.0.0.1
export DATABASE_URL="$E2E_DATABASE_URL"
export NEXT_PUBLIC_SITE_URL="$E2E_BASE" AUTH_URL="$E2E_BASE" AUTH_TRUST_HOST=true
export UPLOAD_DIR="$E2E_UPLOAD_DIR"

# Test-only secrets (also read by the test scripts to sign cookies and webhooks).
export AUTH_SECRET="e2e-auth-secret-not-for-production-0123456789"
export DOWNLOAD_TOKEN_SECRET="e2e-download-token-secret-0123456789abcdef"
export OTP_HASH_SECRET="e2e-otp-hash-secret-0123456789abcdef"
export TELEGRAM_CRON_SECRET="e2e-telegram-cron" PREMIUM_CRON_SECRET="e2e-premium-cron"
export PREMIUM_JOBS=off

# Cloudflare's published always-pass test site key; the secret is left unset so
# the server does not verify the token.
export NEXT_PUBLIC_TURNSTILE_SITE_KEY="1x00000000000000000000AA"
unset TURNSTILE_SECRET_KEY RESEND_API_KEY GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET REDIS_URL
unset SOCIAL_DOWNLOADER_URL SOCIAL_DOWNLOADER_INTERNAL_SECRET
unset TELEGRAM_REQUIRED_CHANNEL TELEGRAM_REQUIRED_CHANNEL_URL TELEGRAM_ADMIN_IDS FREE_DAILY_COURSE_LIMIT

# Shorteners → mock server.
export VPLINK_API_KEY=e2e-vplink GPLINKS_API_TOKEN=e2e-gplinks LINKSHORTIFY_API_TOKEN=e2e-linkshortify
export VPLINK_API_BASE="$E2E_MOCK/vplink/api" GPLINKS_API_BASE="$E2E_MOCK/gplinks/api" LINKSHORTIFY_API_BASE="$E2E_MOCK/linkshortify/api"

# Telegram bot → mock server.
export TELEGRAM_BOT_TOKEN="111111:e2e-bot-token" TELEGRAM_WEBHOOK_PATH=e2ewebhooksegment TELEGRAM_WEBHOOK_SECRET=e2e-webhook-secret
export TELEGRAM_API_BASE="$E2E_MOCK" NEXT_PUBLIC_TELEGRAM_BOT=e2e_test_bot

# Payment gateways → mock server. Rate is the production rule: ₹100 = $1.
export RAZORPAY_KEY_ID=rzp_test_E2E0000000000 RAZORPAY_KEY_SECRET=e2e-razorpay-key-secret RAZORPAY_WEBHOOK_SECRET=e2e-razorpay-webhook-secret
export RAZORPAY_USD_INR_RATE=100 RAZORPAY_API_BASE="$E2E_MOCK/rzp/v1" SUPPORT_TELEGRAM=e2e_support
export NOWPAYMENTS_API_KEY=e2e-nowpayments-key NOWPAYMENTS_IPN_SECRET=e2e-nowpayments-ipn-secret NOWPAYMENTS_API_BASE="$E2E_MOCK/np/v1"
