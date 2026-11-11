#!/usr/bin/env bash
# Runs the browser tests against the test site (see README.md).
#
#   E2E_DATABASE_URL=postgresql://... tests/e2e/run.sh            # everything
#   E2E_DATABASE_URL=postgresql://... tests/e2e/run.sh ux admin   # chosen suites
#   E2E_BROWSERS=webkit tests/e2e/run.sh sweep                    # one engine
#
# Suites: sweep (every page x every device), flows (free unlocks + bot),
# payments (Premium purchase path), admin (sign-in + actions), ux (theme,
# saved courses, search, keyboard, SEO, site rules).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=env.sh
source "$HERE/env.sh" || exit 2
cd "$HERE"

curl -sf -o /dev/null "$E2E_BASE/" || { echo "Test site is not running. Start it: tests/e2e/server.sh start" >&2; exit 2; }
curl -sf -o /dev/null "$E2E_MOCK/__health" || { echo "Mock services are not running. Start them: tests/e2e/server.sh start" >&2; exit 2; }

suites=("$@")
[ ${#suites[@]} -eq 0 ] && suites=(ux payments admin flows sweep)
failed=0
for suite in "${suites[@]}"; do
  echo
  echo "──────── $suite ────────"
  node "$suite.mjs" || failed=1
done
echo
[ "$failed" = "0" ] && echo "ALL SUITES PASSED" || echo "SOME CHECKS FAILED (see above)"
exit "$failed"
