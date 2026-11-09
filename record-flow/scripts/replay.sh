#!/usr/bin/env bash
#
# replay.sh <recording-dir> [spec]
#
# Runs one recorded spec headlessly. The spec already references its
# state-<id>.json through test.use({ storageState }), so the login is skipped.
set -euo pipefail

dir=${1:?usage: replay.sh <recording-dir> [spec]}
playwright_version=${PLAYWRIGHT_VERSION:-1.57.0}

spec=${2:-}
if [[ -z "$spec" ]]; then
  spec=$(ls "$dir"/flow-*.spec.ts 2>/dev/null | head -1)
fi
if [[ -z "$spec" || ! -f "$spec" ]]; then
  echo "no spec found in $dir" >&2
  exit 1
fi

cd "$dir"
exec npx --yes "playwright@${playwright_version}" test "$(basename "$spec")" --reporter=line
