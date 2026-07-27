---
name: wsl-sync-credentials
description: Synchronize Claude credentials from WSL to Windows. Copies .credentials.json from WSL ~/.claude/ to Windows user directory, auto-detecting Windows username or accepting it as a parameter. Use when syncing Claude credentials between WSL and Windows instances.
---

# WSL-to-Windows Credential Sync

Copies your logged-in Claude credentials from WSL to Windows, including OAuth tokens for Atlassian, Notion, and other integrated services.

## Quick start

Run in WSL terminal to sync to Windows:

```bash
bash ~/.claude/skills/wsl-sync-credentials/scripts/sync.sh
```

On first run, it auto-detects your Windows username and prompts if multiple users exist. The username is then saved to `~/.claude/.wsl-sync-config` for future syncs—no more prompts.

## Manual username (skip auto-detect)

```bash
bash ~/.claude/skills/wsl-sync-credentials/scripts/sync.sh neil3
```

Replace `neil3` with your actual Windows username. This also updates the stored config.

## Change stored Windows username

Edit `~/.claude/.wsl-sync-config` directly, or pass a new username as the first argument to re-store it.

## Verify sync

After running, Claude on Windows will have access to your current OAuth tokens:

- Check `C:\Users\{username}\.claude\.credentials.json` exists (8-9 KB)
- Launch Claude on Windows and confirm Atlassian/Notion integrations are active

## Troubleshooting

**"No such file or directory"** on `/mnt/c/Users/...`:
- Ensure you're running from WSL (not Windows PowerShell)
- Check Windows username is correct: `ls /mnt/c/Users/`

**Permission denied**:
- Ensure `/mnt/c/Users/{username}/.claude/` is writable from WSL
- Try `chmod 777` on the target `.claude` directory from Windows

**Want to copy backup too?**

Also copy the backup file to preserve your previous credentials:

```bash
cp ~/.claude/.credentials.json.backup /mnt/c/Users/{username}/.claude/.credentials.json.backup
```
