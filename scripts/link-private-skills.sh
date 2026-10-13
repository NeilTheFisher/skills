#!/usr/bin/env bash
# Symlink every private skill from the `private/` submodule into the flat skills
# root, so Claude Code / Codex / opencode all discover it. The symlink names are
# listed in .gitignore, so the public repo never tracks them.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
priv="$root/private"
[ -d "$priv" ] || { echo "private/ submodule not initialized: run 'git submodule update --init'"; exit 1; }
linked=0
for d in "$priv"/*/; do
  [ -f "${d}SKILL.md" ] || continue
  name="$(basename "$d")"
  ln -sfn "private/$name" "$root/$name"
  linked=$((linked+1))
done
echo "linked $linked private skill(s) into $root"
