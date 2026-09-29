#!/usr/bin/env bash
# Status check for OpenCode v2 support in T3 Code, plus the OpenCode subagent
# resume/cancel work. Read-only; needs `gh` (authenticated) and `jq` on PATH.
#
# Usage: scripts/check.sh
set -uo pipefail

OC_REPO="anomalyco/opencode"
T3_REPO="pingdotgg/t3code"
FORK_REPO="NeilTheFisher/t3code"
LOCAL_FORK="${T3CODE_FORK_DIR:-$HOME/repos/t3code-web-setup/t3code}"

command -v gh >/dev/null || { echo "error: gh not on PATH" >&2; exit 1; }
command -v jq >/dev/null || { echo "error: jq not on PATH" >&2; exit 1; }

line() { printf '%s\n' "------------------------------------------------------------"; }
row()  { printf '  %-7s %s\n' "$1" "$2"; }

pr_line() { # repo number
  gh pr view "$2" --repo "$1" --json state,title,isDraft,updatedAt \
    --jq '"\(.state)\(if .isDraft then " (draft)" else "" end) | \(.title) | updated \(.updatedAt)"' 2>/dev/null \
    || echo "could not fetch PR #$2"
}
issue_line() { # repo number
  gh issue view "$2" --repo "$1" --json state,title,updatedAt \
    --jq '"\(.state) | \(.title) | updated \(.updatedAt)"' 2>/dev/null \
    || echo "could not fetch issue #$2"
}
pr_state() { gh pr view "$2" --repo "$1" --json state -q .state 2>/dev/null || echo UNKNOWN; }

manifest_row() { # repo [ref]
  local ref="${2:-main}"
  gh api "repos/$1/contents/apps/server/src/provider/model-manifest.json?ref=$ref" \
    --jq '.content' 2>/dev/null | base64 -d 2>/dev/null \
    | jq -r '.compatibility[] | select(.driver=="opencode")
        | "recommendedRange=\(.recommendedRange // "n/a")  ranges=[\([.ranges[] | "\(.range):\(.status)"] | join(", "))]"' 2>/dev/null \
    || echo "unavailable"
}

echo "OpenCode v2 status — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
line

echo "Installed opencode:"
if command -v opencode >/dev/null; then
  v="$(opencode --version 2>/dev/null | head -1)"
  row "version" "${v:-unknown}"
  case "$v" in
    2.*|3.*) row "note" "v2+: subagent resume is native; experimental flag not needed." ;;
    1.*)     row "note" "v1: keep OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=1 for background subagents." ;;
    *)       row "note" "version unknown" ;;
  esac
else
  row "version" "opencode not on PATH"
fi

line
echo "OpenCode side ($OC_REPO):"
row "#36423" "$(issue_line "$OC_REPO" 36423)"   # resume works; cancellation still missing
row "#32425" "$(pr_line "$OC_REPO" 32425)"       # interrupt running subagent: steer/cancel/abort
row "#34947" "$(pr_line "$OC_REPO" 34947)"       # dispatch controls on the task tool
row "#41914" "$(issue_line "$OC_REPO" 41914)"    # /tasks list + manage background subagents

line
echo "T3 Code side ($T3_REPO):"
row "#14239" "$(pr_line "$T3_REPO" 14239)"       # detect v1/v2 per instance (maintainer stack)
row "#14269" "$(pr_line "$T3_REPO" 14269)"       # run turns/text/reasoning/tools on v2
row "#13008" "$(pr_line "$T3_REPO" 13008)"       # community: native v2
row "#13452" "$(pr_line "$T3_REPO" 13452)"       # community: v2 server + subagents panel
row "#13958" "$(pr_line "$T3_REPO" 13958)"       # community: v2 server API
row "#12643" "$(pr_line "$T3_REPO" 12643)"       # community draft

line
echo "OpenCode compatibility policy (model-manifest.json):"
row "upstream" "$(manifest_row "$T3_REPO" main)"
row "fork"     "$(manifest_row "$FORK_REPO" main)"
if [ -f "$LOCAL_FORK/apps/server/src/provider/model-manifest.json" ]; then
  row "local" "$(jq -r '.compatibility[] | select(.driver=="opencode")
      | "recommendedRange=\(.recommendedRange // "n/a")  ranges=[\([.ranges[] | "\(.range):\(.status)"] | join(", "))]"' \
      "$LOCAL_FORK/apps/server/src/provider/model-manifest.json" 2>/dev/null || echo "parse error")"
else
  row "local" "fork submodule not found at $LOCAL_FORK"
fi

line
echo "Verdict:"
if [ "$(pr_state "$T3_REPO" 14239)" = "MERGED" ] && [ "$(pr_state "$T3_REPO" 14269)" = "MERGED" ]; then
  echo "  T3 Code OpenCode v2 support has MERGED onto main — check for a release, then consider upgrading."
else
  echo "  T3 Code does NOT support OpenCode v2 on main yet (blocked with a downgrade banner). Do not upgrade."
fi
if [ "$(pr_state "$OC_REPO" 32425)" = "MERGED" ] || [ "$(pr_state "$OC_REPO" 34947)" = "MERGED" ]; then
  echo "  Subagent cancellation/steer controls appear to have landed in OpenCode."
else
  echo "  OpenCode v2 subagent resume works; cancellation/steer controls still pending (see #36423/#32425/#34947)."
fi
line
echo "Links:"
echo "  https://github.com/$OC_REPO/issues/36423"
echo "  https://github.com/$OC_REPO/pull/32425"
echo "  https://github.com/$OC_REPO/pull/34947"
echo "  https://github.com/$OC_REPO/issues/41914"
echo "  https://github.com/$T3_REPO/pull/14239"
echo "  https://github.com/$T3_REPO/pull/14269"
