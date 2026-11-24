#!/usr/bin/env bash
# One-shot: collect leaderboard data for this OpenCode install, then print a
# chat-ready markdown report (table + inline screenshot).
#
#   ./run.sh                          # reasoning-weighted, opencode + opencode-go
#   ./run.sh --task writing           # prose/CV weighting (arena Creative Writing)
#   ./run.sh --provider opencode-go --refresh
#   ./run.sh --models grok-4.7,gemini-4-argon
#   ./run.sh --no-shot                # skip the browser screenshot pass
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

node "$here/collect.mjs" "$@"
node "$here/report.mjs"
