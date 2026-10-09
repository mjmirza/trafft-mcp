#!/usr/bin/env bash
# Gauntlet for run-audit-if-configured.sh. Runs under bash -e like GitHub does.
# Mocks npm so no real audit ever fires, and asserts the skip-vs-run decision.
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
script="$here/run-audit-if-configured.sh"
pass=0
fail=0

mockbin="$(mktemp -d)"
cat > "$mockbin/npm" <<'MOCK'
#!/usr/bin/env bash
echo "NPM_CALLED $*"
exit 0
MOCK
chmod +x "$mockbin/npm"
trap 'rm -rf "$mockbin"' EXIT

check() { if [ "$2" = "$3" ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "FAIL: $1 (expected [$3] got [$2])"; fi; }

# 1. No secrets at all -> skip cleanly, npm NOT called, exit 0.
out="$(env -i PATH="$mockbin:/usr/bin:/bin" bash "$script" 2>&1)"; rc=$?
check "no-secrets exit 0" "$rc" "0"
case "$out" in *Skipping*) check "no-secrets skip message" "yes" "yes";; *) check "no-secrets skip message" "no" "yes";; esac
case "$out" in *NPM_CALLED*) check "no-secrets npm not called" "called" "notcalled";; *) check "no-secrets npm not called" "notcalled" "notcalled";; esac

# 2. One secret missing (no client secret) -> still skip.
out="$(env -i PATH="$mockbin:/usr/bin:/bin" TRAFFT_API_URL="https://x" TRAFFT_CLIENT_ID="id" bash "$script" 2>&1)"; rc=$?
check "partial-secrets exit 0" "$rc" "0"
case "$out" in *NPM_CALLED*) check "partial npm not called" "called" "notcalled";; *) check "partial npm not called" "notcalled" "notcalled";; esac

# 3. All three present -> runs npm audit.
out="$(env -i PATH="$mockbin:/usr/bin:/bin" TRAFFT_API_URL="https://x" TRAFFT_CLIENT_ID="id" TRAFFT_CLIENT_SECRET="sec" bash "$script" 2>&1)"; rc=$?
check "all-secrets exit 0" "$rc" "0"
case "$out" in *"NPM_CALLED run audit"*) check "all-secrets runs audit" "ran" "ran";; *) check "all-secrets runs audit" "notrun" "ran";; esac

# 4. Empty-string secret counts as absent -> skip.
out="$(env -i PATH="$mockbin:/usr/bin:/bin" TRAFFT_API_URL="https://x" TRAFFT_CLIENT_ID="id" TRAFFT_CLIENT_SECRET="" bash "$script" 2>&1)"; rc=$?
check "empty-secret skip exit 0" "$rc" "0"
case "$out" in *NPM_CALLED*) check "empty-secret npm not called" "called" "notcalled";; *) check "empty-secret npm not called" "notcalled" "notcalled";; esac

echo "run-audit-if-configured-test: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
