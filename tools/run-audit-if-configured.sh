#!/usr/bin/env bash
# Runs the endpoint audit only when the three Trafft secrets are present.
# When they are absent (a fork, or a repo without secrets) it skips cleanly
# with exit 0 so the scheduled workflow stays green instead of failing red.
set -uo pipefail

if [ -z "${TRAFFT_API_URL:-}" ] || [ -z "${TRAFFT_CLIENT_ID:-}" ] || [ -z "${TRAFFT_CLIENT_SECRET:-}" ]; then
  echo "::notice::Trafft API secrets are not configured on this repo. Skipping the scheduled audit."
  exit 0
fi

exec npm run audit
