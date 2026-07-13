#!/usr/bin/env bash
# Resolve a Gerrit change (URL, change number, or number/patchset) to a fetch ref.
# Usage: resolve-change.sh <change-url-or-number> [remote]
# Prints: <ref> <change-number> <patchset>
set -euo pipefail

input="${1:?usage: resolve-change.sh <change-url-or-number> [remote]}"
remote="${2:-origin}"

# Extract change number and optional patchset from:
#   https://host/c/project/+/83559[/2]   |  83559[/2]  |  refs/changes/59/83559/2
change="" patchset=""
if [[ "$input" =~ refs/changes/[0-9]+/([0-9]+)/([0-9]+) ]]; then
  change="${BASH_REMATCH[1]}" patchset="${BASH_REMATCH[2]}"
elif [[ "$input" =~ /\+/([0-9]+)(/([0-9]+))? ]]; then
  change="${BASH_REMATCH[1]}" patchset="${BASH_REMATCH[3]:-}"
elif [[ "$input" =~ ^([0-9]+)(/([0-9]+))?$ ]]; then
  change="${BASH_REMATCH[1]}" patchset="${BASH_REMATCH[3]:-}"
else
  echo "error: cannot parse change from: $input" >&2
  exit 1
fi

shard=$(printf '%02d' $((10#$change % 100)))

if [[ -z "$patchset" ]]; then
  # Latest patchset = highest numeric suffix under refs/changes/<shard>/<change>/
  patchset=$(git ls-remote "$remote" "refs/changes/$shard/$change/*" \
    | awk -F/ '$NF ~ /^[0-9]+$/ {print $NF}' | sort -n | tail -1)
  [[ -n "$patchset" ]] || { echo "error: change $change not found on $remote" >&2; exit 1; }
fi

echo "refs/changes/$shard/$change/$patchset $change $patchset"
