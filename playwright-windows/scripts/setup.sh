#!/usr/bin/env bash
# Install playwright-core for the Windows-hosted Chrome helper.
# Installs outside the skills repo so node_modules is never committed.
set -euo pipefail

CACHE="${PW_WINDOWS_CACHE:-$HOME/.cache/playwright-windows}"
VERSION="${PW_WINDOWS_VERSION:-1.65.0}"

mkdir -p "$CACHE"
cd "$CACHE"
if [ ! -f package.json ]; then
  printf '{ "name": "playwright-windows-cache", "private": true }\n' > package.json
fi

echo "Installing playwright-core@$VERSION into $CACHE"
npm install --no-fund --no-audit --prefix "$CACHE" "playwright-core@$VERSION"

node -e "console.log('playwright-core', require('$CACHE/node_modules/playwright-core/package.json').version)"
echo "Done. The helper auto-resolves $CACHE/node_modules/playwright-core."
