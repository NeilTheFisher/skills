---
name: sync-claude-skills
description: Sync Claude skills bidirectionally between Windows and WSL, keeping them in sync based on modification time.
---

# Sync Claude Skills

Synchronizes your custom skills and synced skills between Windows and WSL, keeping both environments up-to-date. The sync uses file modification times to determine which version is newer.

## Quick start

From Windows Claude:
```bash
bash ~/.claude/sync-scripts/sync-skills.sh
```

Or from WSL Claude:
```bash
bash ~/.claude/sync-scripts/sync-skills.sh
```

## How it works

- Compares modification times of skills in both environments
- Copies the newer version to the older location
- If a skill only exists in one place, it gets copied to the other
- Logs which skills were synced and which were skipped

## Usage

Run after you've added a new skill to either Windows or WSL and want to share it with the other environment. The skill directories are:
- **Windows**: `C:\Users\neil3\.claude\skills\`
- **WSL**: `~/.claude/skills/`

Both environments check for newer files and sync automatically.
