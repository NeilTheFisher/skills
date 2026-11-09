#!/usr/bin/env bash
#
# record.sh <url> [sessions] [outdir]
#
# Opens N isolated Playwright codegen windows on <url>, each writing a
# @playwright/test file and a storage state that stop.sh finalises.
set -euo pipefail

url=${1:?usage: record.sh <url> [sessions] [outdir]}
sessions=${2:-2}
outdir=${3:-$HOME/flow-recordings/$(date +%Y%m%d-%H%M%S)}
playwright_version=${PLAYWRIGHT_VERSION:-1.57.0}
letters=(a b c d e f g h i j)

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required" >&2
  exit 1
fi

if (( sessions < 1 || sessions > ${#letters[@]} )); then
  echo "sessions must be between 1 and ${#letters[@]}" >&2
  exit 1
fi

mkdir -p "$outdir"

for ((i = 1; i <= sessions; i++)); do
  id=${letters[$((i - 1))]}
  setsid nohup npx --yes "playwright@${playwright_version}" codegen \
    --target=playwright-test \
    --channel=chrome \
    --save-storage="$outdir/state-$id.json" \
    --output="$outdir/flow-$id.spec.ts" \
    "$url" >"$outdir/codegen-$id.log" 2>&1 </dev/null &
  sleep 1
done

sleep 2
count=$(pgrep -fc "node .*playwright codegen" || true)
echo "recording dir: $outdir"
echo "windows running: ${count:-0}"
echo "when the user is done: ~/.agents/skills/record-flow/scripts/stop.sh $outdir"
