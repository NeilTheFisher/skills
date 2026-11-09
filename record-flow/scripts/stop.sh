#!/usr/bin/env bash
#
# stop.sh <recording-dir>
#
# Stops every codegen window gracefully (SIGINT), which is what makes Playwright
# flush state-<id>.json, then reports what was kept.
set -euo pipefail

outdir=${1:?usage: stop.sh <recording-dir>}

pids=$(pgrep -f "node .*playwright codegen" || true)
if [[ -n "$pids" ]]; then
  # SIGINT, not SIGKILL: Playwright writes the storage state on graceful close.
  kill -INT $pids
  sleep 4
fi

echo "recording dir: $outdir"
for f in "$outdir"/state-*.json; do
  [[ -e "$f" ]] && echo "  state  $(basename "$f") $(wc -c <"$f") bytes"
done
for f in "$outdir"/flow-*.spec.ts; do
  [[ -e "$f" ]] && echo "  spec   $(basename "$f") $(wc -l <"$f") lines"
done
remaining=$(pgrep -fc "node .*playwright codegen" || true)
if [[ "${remaining:-0}" -gt 0 ]]; then
  echo "windows still running: $remaining" >&2
  exit 1
fi
echo "replay with: ~/.agents/skills/record-flow/scripts/replay.sh $outdir"
