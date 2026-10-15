#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

MCPB="npx --yes @anthropic-ai/mcpb@2.1.2"
V="$(node -p "require('./package.json').version")"
OUT="build/mcpb"

test -f dist/cli.js || { echo "dist/cli.js is missing: run npm run build first" >&2; exit 1; }

rm -rf "$OUT"
mkdir -p "$OUT/server"
cp mcpb/manifest.json mcpb/icon.png mcpb/.mcpbignore "$OUT/"
cp -R mcpb/mcpb-resources "$OUT/"
cp package.json package-lock.json "$OUT/server/"
cp -R dist "$OUT/server/"
npm ci --omit=dev --ignore-scripts --no-audit --no-fund --prefix "$OUT/server"

$MCPB validate "$OUT/manifest.json"
$MCPB pack "$OUT" "build/mnogoreels-mcp-$V.mcpb"

(cd build && sha256sum "mnogoreels-mcp-$V.mcpb" > "mnogoreels-mcp-$V.mcpb.sha256")
cp "build/mnogoreels-mcp-$V.mcpb" build/mnogoreels-mcp.mcpb

SIZE="$(wc -c < "build/mnogoreels-mcp-$V.mcpb")"
test "$SIZE" -le 5242880 || { echo "bundle is $SIZE bytes; keep it under 5 MB" >&2; exit 1; }

cat "build/mnogoreels-mcp-$V.mcpb.sha256"
