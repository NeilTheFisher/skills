#!/usr/bin/env bash
#
# replay.sh <recording-dir> [spec]
#
# Runs one recorded spec headlessly with the matching storage state. The
# recording dir gets its own @playwright/test install and a config that uses
# the same system Chrome as codegen, so the spec resolves without a second
# Playwright browser download.
set -euo pipefail

dir=${1:?usage: replay.sh <recording-dir> [spec]}
playwright_version=${PLAYWRIGHT_VERSION:-1.57.0}

if [[ ! -d "$dir" ]]; then
  echo "no such recording dir: $dir" >&2
  exit 1
fi

spec=${2:-}
if [[ -z "$spec" ]]; then
  spec=$(ls "$dir"/flow-*.spec.ts 2>/dev/null | head -1)
fi
if [[ -z "$spec" || ! -f "$spec" ]]; then
  echo "no spec found in $dir" >&2
  exit 1
fi

cd "$dir"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required" >&2
  exit 1
fi

if [[ ! -f package.json ]]; then
  npm init -y >/dev/null
fi
if [[ ! -x node_modules/.bin/playwright ]]; then
  npm install --no-audit --no-fund --save-dev "@playwright/test@$playwright_version" >/dev/null
fi

if [[ ! -f playwright.config.ts ]]; then
  cat > playwright.config.ts <<'EOF'
import { defineConfig } from '@playwright/test';

const storageState = process.env.RECORD_FLOW_STATE;

export default defineConfig({
  use: {
    channel: 'chrome',
    ...(storageState ? { storageState } : {}),
  },
});
EOF
fi

id=$(basename "$spec" .spec.ts)
id=${id#flow-}
state="state-$id.json"
if [[ -f "$state" ]]; then
  export RECORD_FLOW_STATE="$state"
fi

exec ./node_modules/.bin/playwright test "$(basename "$spec")" --reporter=line
