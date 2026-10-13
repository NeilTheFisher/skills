#!/usr/bin/env bash
set -euo pipefail
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST=/mnt/c/Users/Public/disk-cleanup
mkdir -p "$DEST"
cp "$SRC"/clean-windows-caches.ps1 "$DEST"/
PS="$(command -v powershell.exe || true)"
[ -z "$PS" ] && PS=/mnt/c/WINDOWS/System32/WindowsPowerShell/v1.0/powershell.exe
"$PS" -NoProfile -ExecutionPolicy Bypass -File 'C:\Users\Public\disk-cleanup\clean-windows-caches.ps1'
