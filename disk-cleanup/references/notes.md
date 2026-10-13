# Disk cleanup notes

Hard-won details behind `SKILL.md`. Read this before acting on a real drive.

## Measurement

- **`Get-ChildItem -Recurse` can abort on a reparse point and return a bogus
  tiny size.** Observed on this machine: `C:\Users` measured ~0 MB and
  `C:\Users\neil3` 0 MB with a `Win32Exception`, while the real profile is
  ~58 GB. The `-Recurse` pipeline stops at the offending reparse point instead
  of continuing. Use the reparse-safe enumerator in `scripts/scan-drive.ps1`.
- **`du` on `/mnt/c` or `/mnt/d` (drvfs) is unreliable.** It reports
  `st_blocks` (allocated), which is 0 for cloud placeholders and sometimes 0 or
  wrong for directories it can't stat. Use Windows PowerShell logical sizes
  (`Get-ChildItem -Recurse -Force | Measure-Object Length -Sum`) for hydrated
  files, and treat cloud-synced folders separately.
- **Cloud folders lie about size.** OneDrive / Files On-Demand showed 149 GB
  logical but ~1.5 GB on disk (dehydrated) on one machine. Explorer shows the
  logical size. Check reparse/placeholder status before treating it as a target.
- **Root files are excluded from folder scans**: `pagefile.sys`, `hiberfil.sys`,
  `swapfile.sys` sit at the drive root. They can be tens of GB and are invisible
  to a "top-level folders" scan.
- **Junctions/reparse points double-count.** A `Program Files (x86)` that reads
  1.1 TB is usually a junction farm; inspect with
  `Get-ChildItem | Select Name, @{n='Reparse';e={$_.Attributes -match 'ReparsePoint'}}`.
- `cmd /c dir /s /a` works but is much slower than PowerShell on huge trees, and
  `cmd.exe`/`powershell.exe` are not always on the WSL `PATH` — use the full path
  `/mnt/c/WINDOWS/System32/...` as the scripts do.

## Elevation

- Caches under `$env:USERPROFILE` delete **without** admin.
- `C:\ProgramData\...` (e.g. `ProgramData\NVIDIA\NGX`), `C:\Windows\Temp`, and
  DISM/`cleanmgr`/`vssadmin` need **admin**. Try non-elevated first (much of
  ProgramData is user-writable); only elevate what fails. Elevating from WSL
  (`Start-Process -Verb RunAs`) pops a UAC prompt on the Windows desktop.

## What is safe to delete (regenerates)

- NVIDIA `Local\NVIDIA\DXCache` + `GLCache` (shader caches), `ProgramData\NVIDIA\NGX`
  (DLSS models, re-downloaded), NVIDIA app `UpdateFramework`/`Installer`.
- `AppData\Local\Temp`, `AppData\Local\pip\cache`, `AppData\Local\npm-cache`,
  `~/.cache/*` tool caches (uv, huggingface — confirm with user; models may be
  expensive to re-download), `~/.uv_cache`, `.pnpm-store` (hardlink store; deleting
  is safe).
- VS Code `Cache`, `Code Cache`, `GPUCache`, `CachedData`, `CachedExtensionVSIXs`,
  `Partitions`, `Crashpad`, `WebStorage`, `logs`, `User\workspaceStorage`,
  `User\History`. **Keep `User\globalStorage`** (extension state/tokens) and the
  `settings.json`/`keybindings.json` files at the `User` root.
- `vscode-remote-wsl\<edition>\<hash>` — one dir per remote server commit. Keep
  the newest, delete the rest; VS Code re-downloads on next connect.
- Browser `Cache`/`Code Cache`/`GPUCache`.

## What NOT to delete (move or leave)

- Game installs (Steam under `Program Files (x86)` can be ~1 TB), Android SDKs,
  model caches, `google takeout`, torrents, media — real data. Relocate to a
  larger drive instead.

## Docker

- Check where data lives: `docker info | grep -i "Docker Root Dir"`. On a
  Docker-Desktop-with-WSL-integration setup the daemon may be `docker-desktop`
  (data on the host, e.g. `D:\DockerData`); on a native `docker-ce`-in-WSL setup
  the root is `/var/lib/docker` **inside the Ubuntu `ext4.vhdx`** — so pruning
  frees space inside the vhdx, not on the host, until compaction.
- `docker system prune -a --volumes -f` reclaims unused images (`-a`), build
  cache, stopped containers, and **anonymous** volumes. Named volumes survive
  `--volumes`. Measure first with `docker system df`.
- Stale Docker Desktop data (`D:\DockerData\disk\docker_data.vhdx`, old mtime)
  can be tens of GB if the user switched to native WSL docker — confirm before
  deleting.

## WSL vhdx compaction (do this LAST, and NOT from inside WSL)

The vhdx never shrinks on its own. Compaction requires `wsl --shutdown`, which
kills any agent session running inside WSL — so an agent must hand this to the
user to run when they can restart WSL. Run it **after** Docker prune so more is
reclaimed.

Two ready-made scripts live at `D:\WSL\`:
`compact-wsl-vhdx-optimize.ps1` (uses `Optimize-VHD`; needs the Hyper-V module,
present on Pro) and `compact-wsl-vhdx-diskpart.bat` (fallback). They fstrim,
shut down WSL, wait, then compact. Manual equivalent:

```powershell
wsl.exe -d Ubuntu -u root -- fstrim -av
wsl.exe --shutdown
Optimize-VHD -Path 'D:\WSL\ext4.vhdx' -Mode Full   # or diskpart compact vdisk
```

Enabling `sparseVhd` (`wsl --manage Ubuntu --set-sparse true`) lets the vhdx
shrink automatically going forward, at a small I/O cost.
