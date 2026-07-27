#!/bin/bash
# Wrapper script to run the appropriate sync script based on environment

SCRIPT_DIR="$HOME/.claude/sync-scripts"

if [ ! -f "$SCRIPT_DIR/sync-skills.sh" ]; then
  echo "ERROR: sync-skills.sh not found at $SCRIPT_DIR/"
  echo "Ensure the sync scripts are installed in ~/.claude/sync-scripts/"
  exit 1
fi

bash "$SCRIPT_DIR/sync-skills.sh"
