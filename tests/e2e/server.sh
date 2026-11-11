#!/usr/bin/env bash
# Builds and runs the site for browser tests, on its own port, against a
# throwaway database and mock outside services (see env.sh).
#
#   E2E_DATABASE_URL=postgresql://... tests/e2e/server.sh build    # production build with test settings
#   E2E_DATABASE_URL=postgresql://... tests/e2e/server.sh start    # mock services + site in the background
#   tests/e2e/server.sh stop
#
# Note: `build` writes to the project's .next folder. The live site does not
# run from there (scripts/deploy.sh builds its own copy), but a later
# `npm run build` or deploy rebuilds it with real settings anyway.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
RUN="${E2E_RUN_DIR:-/tmp/coursevault-e2e-run}"
mkdir -p "$RUN"

port_pid() { ss -ltnp 2>/dev/null | grep ":$1 " | grep -oP 'pid=\K[0-9]+' | head -1 || true; }

stop() {
  for port in "${E2E_PORT:-3999}" "${E2E_MOCK_PORT:-47000}"; do
    pid="$(port_pid "$port")"
    if [ -n "$pid" ]; then kill "$pid" 2>/dev/null || true; fi
  done
}

case "${1:-}" in
  build)
    # shellcheck source=env.sh
    source "$HERE/env.sh"
    cd "$ROOT"
    npm run build > "$RUN/build.log" 2>&1 || { tail -40 "$RUN/build.log"; exit 1; }
    cp -r .next/static .next/standalone/.next/static
    cp -r public .next/standalone/public
    # The standalone folder gets a copy of the project's real .env. The test
    # server must never read it.
    if [ -f .next/standalone/.env ]; then mv .next/standalone/.env .next/standalone/.env.disabled; fi
    grep -E "First Load JS shared" "$RUN/build.log" || true
    ;;
  start)
    # shellcheck source=env.sh
    source "$HERE/env.sh"
    stop
    sleep 1
    mkdir -p "$E2E_UPLOAD_DIR"
    [ -f "$ROOT/.next/standalone/server.js" ] || { echo "No build found. Run: tests/e2e/server.sh build" >&2; exit 1; }
    if [ -f "$ROOT/.next/standalone/.env" ]; then mv "$ROOT/.next/standalone/.env" "$ROOT/.next/standalone/.env.disabled"; fi
    setsid nohup node "$HERE/mock-server.mjs" > "$RUN/mock.log" 2>&1 < /dev/null &
    cd "$ROOT/.next/standalone"
    setsid nohup node server.js > "$RUN/server.log" 2>&1 < /dev/null &
    for _ in $(seq 1 40); do
      code="$(curl -s -o /dev/null -w '%{http_code}' "$E2E_BASE/" || true)"
      [ "$code" = "200" ] && break
      sleep 1
    done
    [ "${code:-}" = "200" ] || { echo "Test site did not start. See $RUN/server.log" >&2; tail -20 "$RUN/server.log" >&2; exit 1; }
    echo "test site: $E2E_BASE   mock services: $E2E_MOCK   logs: $RUN"
    ;;
  stop)
    stop
    echo "stopped"
    ;;
  *)
    echo "usage: $0 build|start|stop" >&2
    exit 2
    ;;
esac
