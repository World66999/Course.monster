#!/usr/bin/env bash
#
# Installs the Telegram bot token as a deployment secret.
#
# The token is read from a hidden prompt (or stdin), never passed as an
# argument, so it does not land in shell history, `ps` output, or a chat
# transcript. It is written only to /opt/coursevault/.env, which is root-owned
# and never committed.
#
# Usage:  sudo bash scripts/set-telegram-token.sh
set -euo pipefail

ENV_FILE=${ENV_FILE:-/opt/coursevault/.env}
[ -f "$ENV_FILE" ] || { echo "No env file at $ENV_FILE" >&2; exit 1; }

if [ -t 0 ]; then
  printf 'Paste the bot token (input hidden), then press Enter: '
  read -rs TOKEN
  printf '\n'
else
  read -r TOKEN            # allows: echo "$TOKEN" | sudo bash scripts/set-telegram-token.sh
fi

TOKEN=$(printf '%s' "$TOKEN" | tr -d '[:space:]')
[ -n "$TOKEN" ] || { echo "No token supplied." >&2; exit 1; }
if ! printf '%s' "$TOKEN" | grep -qE '^[0-9]{6,12}:[A-Za-z0-9_-]{30,}$'; then
  echo "That does not look like a Bot API token (expected <digits>:<secret>)." >&2
  exit 1
fi

# Validate against Telegram before storing, so a typo fails here rather than
# silently leaving the bot dead. Only the username is ever printed.
echo "Checking the token with Telegram…"
RESPONSE=$(curl -sS -m 15 "https://api.telegram.org/bot${TOKEN}/getMe" || true)
if ! printf '%s' "$RESPONSE" | grep -q '"ok":true'; then
  # Print Telegram's reason, never the request URL (which contains the token).
  REASON=$(printf '%s' "$RESPONSE" | sed -n 's/.*"description":"\([^"]*\)".*/\1/p')
  echo "Telegram rejected the token: ${REASON:-unreachable}" >&2
  exit 1
fi
USERNAME=$(printf '%s' "$RESPONSE" | sed -n 's/.*"username":"\([^"]*\)".*/\1/p')
echo "Token is valid — bot is @${USERNAME}"

cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%s)"

# Rewrite the two keys in place without ever expanding the token in the shell.
TOKEN="$TOKEN" USERNAME="$USERNAME" python3 - "$ENV_FILE" <<'PY'
import os, re, sys
path = sys.argv[1]
with open(path) as fh:
    text = fh.read()
for key, value in (("TELEGRAM_BOT_TOKEN", os.environ["TOKEN"]),
                   ("NEXT_PUBLIC_TELEGRAM_BOT", os.environ["USERNAME"])):
    line = f'{key}="{value}"'
    if re.search(rf'(?m)^{key}=.*$', text):
        text = re.sub(rf'(?m)^{key}=.*$', line, text)
    else:
        text = text.rstrip("\n") + "\n" + line + "\n"
with open(path, "w") as fh:
    fh.write(text)
PY
chmod 600 "$ENV_FILE"
unset TOKEN

echo
echo "Stored in $ENV_FILE (mode 600). Next:"
echo "  1. sudo bash scripts/deploy.sh     # rebuild: the bot username is baked in at build time"
echo "  2. Admin panel -> Telegram Bot -> Register webhook"
echo
echo "The token is not printed anywhere above, and is not in git."
