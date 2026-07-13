#!/usr/bin/env bash
# Poll Gerrit for new patchsets on open changes; print only ones not seen before.
# Usage: poll-new-changes.sh [project] [host] [query-extra]
# Output: one line per new patchset: <change> <patchset> <ref> <owner-username> <subject>
# First run (no seen-file) seeds the baseline and prints nothing.
set -euo pipefail

project="${1:-summit/web/bin/spotlight/director}"
host="${2:-nfisher@yul01dvlscm01.summit-tech.org}"
extra="${3:-}"

state_dir="$HOME/.cache/gerrit-autoreview"
mkdir -p "$state_dir"
seen_file="$state_dir/$(echo "$project" | tr '/' '_').seen"

results=$(ssh -p 29418 "$host" gerrit query --format=JSON --current-patch-set \
  "project:$project status:open $extra" limit:25 \
  | grep -v '"type":"stats"' || true)

first_run=0
[[ -f "$seen_file" ]] || { first_run=1; : > "$seen_file"; }

while IFS= read -r line; do
  [[ -n "$line" ]] || continue
  change=$(echo "$line" | grep -o '"number":[0-9]*' | head -1 | cut -d: -f2)
  ps=$(echo "$line" | grep -o '"currentPatchSet":{"number":[0-9]*' | grep -o '[0-9]*$')
  ref=$(echo "$line" | grep -o '"ref":"[^"]*"' | head -1 | cut -d'"' -f4)
  owner=$(echo "$line" | grep -o '"username":"[^"]*"' | head -1 | cut -d'"' -f4)
  subject=$(echo "$line" | grep -o '"subject":"[^"]*"' | head -1 | cut -d'"' -f4)
  [[ -n "$change" && -n "$ps" ]] || continue
  key="$change/$ps"
  if ! grep -qxF "$key" "$seen_file"; then
    echo "$key" >> "$seen_file"
    [[ "$first_run" -eq 1 ]] || echo "$change $ps $ref $owner $subject"
  fi
done <<< "$results"

[[ "$first_run" -eq 1 ]] && echo "BASELINE $(wc -l < "$seen_file") open changes recorded, none reported as new" >&2
exit 0
