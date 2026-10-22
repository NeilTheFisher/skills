---
name: sys-health
description: Read-only audit of a Windows + WSL2 system: disk (including WSL vhdx bloat and package caches), Docker, Windows storage, startup apps, WSL config, backups, and T3 state DB. Reports reclaimable space with risk levels, and offers a confirmation-gated clean mode. Use when the user asks to check system health, free space, what's slowing the machine, or to run a monthly cleanup. Works on Windows 11 + WSL2 (Ubuntu).
---

# System Health Audit (Windows + WSL2)

Read-only by default. Nothing is deleted, uninstalled, or reconfigured unless the user confirms each step. Every recommendation carries an estimated reclaim and a risk level.

## When to use

- "What's eating my disk / slowing this down?"
- "Run the monthly clean" / "audit my system"
- Before/after a big install, or when C: / D: is filling up
- The user pasted the "7 prompts" IT-technician tweet and wants the real version

## Safety rules (non-negotiable)

1. **Never delete without per-item confirmation.** Report first; ask; then act.
2. **Never touch these without explicit, separate confirmation:** T3 state DB, WinSxS, anything under `C:\Windows`, node_modules of active projects (director, router, director-api, verse), and the WSL `.wslconfig`.
3. **Always show a diff before editing config files.**
4. **Read-only collection must not lock databases.** Open SQLite with `mode=ro` and a short timeout.
5. **WSL collection runs inside WSL; Windows collection runs via PowerShell** (`/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe`) to avoid slow 9p mounts and inaccurate placeholder sizes.

## Collection

### WSL side

```bash
# Memory / swap / disk
free -h
df -hT | grep -Ev 'tmpfs|udev|snapfuse'
cat /mnt/c/Users/<user>/.wslconfig

# Home size (top-level, bounded)
du -x -d1 ~ 2>/dev/null | sort -rh | head -20

# Caches
du -sh ~/.bun/install/cache ~/.npm/_cacache ~/.local/share/pnpm ~/.cache/uv \
       /var/cache/apt/archives 2>/dev/null
journalctl --disk-usage
docker system df

# WSL vhdx on-disk vs in-use
# (Windows-side; see PowerShell below)

# Redsocks / tailscale
dpkg -l | grep -iE 'redsocks|tailscale'
systemctl is-active redsocks 2>/dev/null

# Failed mounts
systemctl --failed --no-legend
```

### Windows side (PowerShell, run from WSL)

```powershell
$PS = '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe'
& $PS -NoProfile -Command "
  '== VOLUMES =='; Get-Volume | Where DriveLetter | Select DriveLetter,FileSystemLabel,@{n='SizeGB';e={[math]::Round($_.Size/1GB,1)}},@{n='FreeGB';e={[math]::Round($_.SizeRemaining/1GB,1)}} | Format-Table -AutoSize
  '== RAM =='; Get-CimInstance Win32_ComputerSystem | Select @{n='TotalGB';e={[math]::Round($_.TotalPhysicalMemory/1GB,1)}}
  '== TOP MEMORY =='; Get-Process | Sort WS -Desc | Select -First 12 Name,@{n='MemMB';e={[math]::Round($_.WS/1MB)}}
  '== VHDX =='; Get-ChildItem 'D:\' -Recurse -Filter *.vhdx -Force -ErrorAction SilentlyContinue -Depth 6 | Select FullName,@{n='GB';e={[math]::Round($_.Length/1GB,1)}}
  '== STARTUP =='; (Get-CimInstance Win32_StartupCommand).Count
  '== DEFENDER =='; Get-MpComputerStatus | Select AntivirusEnabled,RealTimeProtectionEnabled,QuickScanAge,FullScanAge
  '== DISKS =='; Get-PhysicalDisk | Select FriendlyName,MediaType,HealthStatus
  '== PENDING REBOOT =='; Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending'
  '== LAST UPDATES =='; Get-HotFix | Sort InstalledOn -Desc | Select -First 5 HotFixID,InstalledOn | Format-Table -AutoSize
"
```

### OneDrive note (important)

OneDrive Pictures/Videos folders often report huge logical sizes (100+ GB) while being **cloud-only placeholders**. Do not flag them as local bloat. Verify with:

```powershell
$files = Get-ChildItem 'C:\Users\<user>\OneDrive\Pictures' -Recurse -File -Force -ErrorAction SilentlyContinue | Select -First 500
'cloud-only (RecallOnDataAccess): ' + ($files | Where-Object { $_.Attributes.value__ -band 0x400000 }).Count
```

If most files carry the `RecallOnDataAccess` (0x400000) flag, OneDrive is not consuming local disk — skip it in the report.

### T3 state DB (read-only)

```python
import sqlite3
con = sqlite3.connect('file:/home/<user>/.t3/userdata/statev2.sqlite?mode=ro', uri=True, timeout=10)
# tables + counts
# dbstat for per-object sizes
# freelist_count * page_size = reclaimable via VACUUM
```

Report the top 10 tables/indexes by size and the top 10 threads by message/event count. Never VACUUM or delete without explicit confirmation (T3 must be stopped first).

## Report format

Produce a prioritized table:

| # | Finding | Reclaim (est.) | Risk | Notes |
|---|---------|----------------|------|-------|

Risk levels: **Low** (caches, logs, temp), **Medium** (Docker images, node_modules, journal vacuum), **High** (WinSxS, T3 DB, startup changes, WSL config).

Always include a "already good" section (TRIM, SSD health, Defender, updates, power plan) so the user sees what not to touch.

## Clean mode (confirmation-gated)

Offer each step individually. Proposed steps and their defaults from the grilling session:

1. **WSL package caches** — clear all of: `~/.bun/install/cache`, `~/.npm/_cacache`, `~/.local/share/pnpm`, `~/.cache/uv`. (~100 GB.) Low risk; re-download on demand.
2. **Docker** — `docker builder prune -f` (build cache), `docker image prune -a`, `docker volume prune`. (~49 GB.) Medium risk; only unused resources.
3. **Windows temp + pip cache** — clear `%TEMP%` and `%LOCALAPPDATA%\pip\cache`. (~8 GB.) Low risk.
4. **redsocks** — if installed and only tailscale is used: `sudo apt remove --purge redsocks`, disable service, remove `/etc/redsocks.conf*`. Low risk (tailscale replaces it).
5. **Log rotation** — add a logrotate rule for `/var/log/redsocks.log`; cap journald via `/etc/systemd/journald.conf` (`SystemMaxUse=500M`). Low risk.
6. **node_modules** — prune directories untouched > 60 days, **excluding** `director`, `router`, `director-api`, `verse` and their worktrees. (~tens of GB.) Medium risk; reinstall with package manager when needed.
7. **Duplicate startup entry** — remove the duplicate `Folding@home` entry from Common Startup (it is registered twice). Low risk (app is disabled anyway).
8. **Journal vacuum** — `sudo journalctl --vacuum-size=500M`. Low risk.
9. **WSL vhdx compact** — do **not** run from inside WSL; hand the user `D:\WSL\compact-wsl-vhdx-diskpart.bat` (a thin wrapper around `D:\WSL\compact-wsl-vhdx.ps1`). It self-elevates, captures all output to `D:\WSL\logs\`, and runs fstrim first. The old Hyper-V `Optimize-VHD` version is archived in `D:\WSL\OLD\`. Note: prior runs that reclaimed nothing usually failed because WSL/Docker Desktop was still holding the vhdx — quit Docker Desktop first and confirm fstrim printed success.
10. **T3 state DB** — report only; VACUUM reclaim (~10.8 GB) is High risk and requires T3 stopped. Leave unless user explicitly asks.

Do **not** enable `sparseVhd` (reports of data loss/corruption) and note that `autoMemoryReclaim` defaults to `gradual` already, so only propose changes that are not already defaults. Show a diff before any `.wslconfig` edit.

## WSL config diff (current vs proposed)

Current (`~/.wslconfig` on the Windows side, e.g. `C:\Users\<user>\.wslconfig`):

```
[wsl2]
memory=22GB
swap=2GB
MaxCrashDumpCount=-1
networkingMode=mirrored
dnsTunneling=true
autoProxy=true
firewall=false
```

Proposed diff: only change `swap` (2GB -> 4GB or 8GB) given the OOM history; do **not** add `sparseVhd`, do **not** re-add `autoMemoryReclaim` (default). Show the diff and let the user apply. If they want no change, skip.

## Baseline diff

Save each run's JSON to `~/.cache/sys-health/<timestamp>.json` (or `~/.local/share/sys-health/`). On the next run, compare totals and flag anything that grew > 20% or > 5 GB.

## Success criteria

- Report produced with reclaim estimates and risk levels.
- No file deleted without explicit confirmation.
- Clean mode never runs unattended.
- WSL vhdx and T3 DB left untouched unless explicitly requested.