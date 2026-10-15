#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
while IFS= read -r name; do unset "$name"; done < <(compgen -e | grep '^MNOGOREELS_' || true)

PORT=18080
BASE="http://127.0.0.1:$PORT"
MCP_STORAGE_DIR="$(mktemp -d)"
export MCP_STORAGE_DIR
SERVER_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]]; then kill "$SERVER_PID" 2>/dev/null || true; fi
  rm -rf "$MCP_STORAGE_DIR"
}
trap cleanup EXIT

inspect() {
  npx --yes @modelcontextprotocol/inspector@2.10.1 --cli "$@"
}

check() {
  local label=$1 filter=$2 out
  shift 2
  if out=$(inspect "$@" --format json) && jq -e "$filter" <<<"$out" >/dev/null; then
    echo "ok   $label"
  else
    echo "FAIL $label (expected $filter)" >&2
    jq -c '.result | with_entries(if (.value | type) == "array" then .value |= length else . end)' <<<"$out" >&2 2>/dev/null ||
      echo "${out:0:500}" >&2
    exit 1
  fi
}

STDIO=(node dist/cli.js)

check 'stdio tools/list = 19' '.result.tools | length == 19' "${STDIO[@]}" --method tools/list
check 'stdio tools/list --strict has no error findings' \
  '[.schemaFindings[]?.findings[]? | select(.severity == "error")] | length == 0' \
  "${STDIO[@]}" --method tools/list --strict
check 'stdio prompts/list = 5' '.result.prompts | length == 5' "${STDIO[@]}" --method prompts/list
check 'stdio resources/list = 3' '.result.resources | length == 3' "${STDIO[@]}" --method resources/list
check 'stdio get_options_guide succeeds' '.result.isError != true' \
  "${STDIO[@]}" --method tools/call --tool-name get_options_guide --tool-args-json '{"topic":"pricing"}'
check 'stdio get_account is unauthenticated' '.result.structuredContent.authenticated == false' \
  "${STDIO[@]}" --method tools/call --tool-name get_account --tool-args-json '{}'

MNOGOREELS_PORT=$PORT node dist/cli.js --http &
SERVER_PID=$!
curl -fs --retry 20 --retry-all-errors --retry-delay 1 "$BASE/healthz" >/dev/null || {
  echo "FAIL http server did not answer $BASE/healthz" >&2
  exit 1
}

check 'http /mcp tools/list = 19' '.result.tools | length == 19' \
  --transport http --server-url "$BASE/mcp" --connect-timeout 10000 --stored-auth-only --method tools/list
check 'http /mcp/readonly tools/list = 13' '.result.tools | length == 13' \
  --transport http --server-url "$BASE/mcp/readonly" --connect-timeout 10000 --stored-auth-only --method tools/list

if curl -fsS "$BASE/.well-known/mcp/server-card.json" | jq -e '.name == "ru.mnogo-reels/mnogoreels"' >/dev/null; then
  echo "ok   http server card"
else
  echo "FAIL http server card" >&2
  exit 1
fi
