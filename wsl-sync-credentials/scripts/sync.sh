#!/bin/bash
set -e

CREDENTIALS_FILE="$HOME/.claude/.credentials.json"
CONFIG_FILE="$HOME/.claude/.wsl-sync-config"

if [ ! -f "$CREDENTIALS_FILE" ]; then
  echo "Error: Credentials file not found at $CREDENTIALS_FILE"
  exit 1
fi

WINDOWS_USER="${1:-}"

if [ -z "$WINDOWS_USER" ] && [ -f "$CONFIG_FILE" ]; then
  WINDOWS_USER=$(cat "$CONFIG_FILE" | grep "^WINDOWS_USER=" | cut -d'=' -f2)
fi

if [ -z "$WINDOWS_USER" ]; then
  USERS=$(ls /mnt/c/Users/ 2>/dev/null | grep -v "^Default\|^Public\|^All Users\|^Default User" | grep -v " -> ")
  USER_COUNT=$(echo "$USERS" | wc -l)

  if [ "$USER_COUNT" -eq 1 ]; then
    WINDOWS_USER=$(echo "$USERS" | head -1)
    echo "Auto-detected Windows user: $WINDOWS_USER"
  else
    echo "Multiple Windows users found:"
    select WINDOWS_USER in $USERS; do
      [ -n "$WINDOWS_USER" ] && break
    done
  fi
fi

echo "WINDOWS_USER=$WINDOWS_USER" > "$CONFIG_FILE"

WINDOWS_CLAUDE_DIR="/mnt/c/Users/$WINDOWS_USER/.claude"

if [ ! -d "$WINDOWS_CLAUDE_DIR" ]; then
  echo "Creating $WINDOWS_CLAUDE_DIR..."
  mkdir -p "$WINDOWS_CLAUDE_DIR"
fi

echo "Copying credentials to Windows..."
cp "$CREDENTIALS_FILE" "$WINDOWS_CLAUDE_DIR/.credentials.json"

if [ -f "$HOME/.claude/.credentials.json.backup" ]; then
  cp "$HOME/.claude/.credentials.json.backup" "$WINDOWS_CLAUDE_DIR/.credentials.json.backup"
  echo "✓ Also copied .credentials.json.backup"
fi

if [ -f "$WINDOWS_CLAUDE_DIR/.credentials.json" ]; then
  SIZE=$(ls -lh "$WINDOWS_CLAUDE_DIR/.credentials.json" | awk '{print $5}')
  echo "✓ Credentials synced successfully ($SIZE)"
  echo "  Location: C:\Users\$WINDOWS_USER\.claude\.credentials.json"
else
  echo "Error: Sync verification failed"
  exit 1
fi
