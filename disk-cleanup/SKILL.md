---
name: disk-cleanup
description: >
  Diagnose what is consuming space on a Windows drive (C:, D:, …) and report
  what could be reclaimed. Read-only by default — never delete, move, or modify
  anything without the user's explicit per-item approval. Use when the user says
  a drive is full or nearly full, asks "what's taking so much storage", wants a
  disk-space report, or asks which folders could be freed.
---

# Disk space diagnosis (Windows drives)

This skill is **diagnosis-first**. Measure and report. Do **not** delete, move,
or modify anything until the user approves that specific item — "clean up my
drive" / "run it on D" is a request to *find* what's taking space, not
permission to remove. Present findings and suggestions, then wait.

## Tools

- Windows-native and scriptable: PowerShell (`scripts/scan-drive.ps1`) or
  `robocopy /l`.
- The user's usual GUI: **TreeSize**. Faster alternative: **WizTree** (reads the
  NTFS MFT, whole drive in seconds; CLI export:
  `WizTree64.exe /admin /export=C:\wiz.csv C:\`).
- If the space turns out to be inside WSL, WSL tools apply (`du -x`, `ncdu`,
  `dust`, `docker system df`) — but lead with the view the user asked for. If
  they want a Windows perspective, use the Windows tools above.

## Scan

```bash
bash scripts/scan-drive.sh C     # or D, E, ...
```

Prints top-level folder sizes plus root files (`pagefile.sys` / `hiberfil.sys`
sit at the drive root, so a folder scan misses them). Drill into the top buckets
with the same script logic.

## Report, then stop

List the biggest consumers, mark each as **real data** vs **regenerable cache**,
and give suggestions — then stop and wait for approval. Typical *suggestions*
(never actions taken unasked): stale Docker Desktop data, dev caches
(`.uv_cache`, `.pnpm-store`, `.gradle`), old VS Code remote-server copies, game
installs, old installers, `hiberfil.sys`.

Only after explicit approval, one category at a time, use `references/notes.md`
(safe-to-delete list, elevation, Docker prune, and the WSL vhdx compaction the
user must run themselves).

## Accuracy gotchas (details in `references/notes.md`)

- **`Get-ChildItem -Recurse` can abort on a reparse point and return a bogus
  tiny size** (e.g. `C:\Users` measuring 0 MB when it holds ~60 GB). The bundled
  scanner uses a reparse-safe enumerator for this reason.
- `du` on `/mnt/c` / `/mnt/d` is unreliable; cloud folders report logical size
  far larger than on-disk.
- Junctions/reparse points double-count; root files are excluded from folder scans.
