---
name: work-vpn
description: "Establish Summit Corp network access from WSL so internal hosts (yul01dvlscm01.summit-tech.org Gerrit, split-DNS .summit-tech.org names) resolve and are reachable. Use when an internal hostname doesn't resolve, test:ci/docker builds fail on composer/SSH steps, or the Tailscale mesh is down. Launch the Windows Tailscale GUI + Proxifier, verify the mesh + DNS, and restart the service if it's stuck."
---

# work-vpn — reach Summit internal hosts from WSL

Use when internal Summit hosts (`*.summit-tech.org`, `*.summit-tech.ca`) don't resolve or aren't reachable from WSL — e.g. `test:ci` docker builds fail at the legacy `composer install` step because it can't SSH to `yul01dvlscm01.summit-tech.org:29418` (Gerrit).

## Architecture (from ~/docs/remote-network.md)

- neilpc (Windows Tailscale client) → mesh → laptop **SUMMIT008** (`100.75.98.9`, exit node + subnet routes) → office.
- **tailsocks** SOCKS5 on `127.0.0.1:15040` (auto-starts via HKCU Run key), exit node SUMMIT008.
- **Proxifier** routes `*.summit-tech.org` etc. through tailsocks.
- **Split-DNS** (Tailscale admin): `.summit-tech.org` etc. → internal DNS `10.0.100.5`.

## Quick steps

1. **Verify mesh is up** (fastest signal):
   ```bash
   /mnt/c/'Program Files'/Tailscale/tailscale.exe status 2>&1 | grep -v version
   ```
   - Look for `summit008-1 ... active; offers exit node` → mesh is up.
   - `NoState` or "Tailscale is starting" → service is unhealthy, see step 4.

2. **Verify the internal host resolves**:
   ```bash
   getent hosts yul01dvlscm01.summit-tech.org   # expect 10.0.x.x (split-DNS), NOT NXDOMAIN
   ```
   Public DNS (8.8.8.8) will NOT resolve it — that's normal. It must come from split-DNS.

3. **Verify reachability** (composer uses SSH to Gerrit port 29418):
   ```bash
   SSH_AUTH_SOCK=<agent sock> timeout 15 ssh -p 29418 -o StrictHostKeyChecking=no \
     -o ConnectTimeout=8 nfisher@yul01dvlscm01.summit-tech.org 2>&1 | head -2
   ```
   A connection (even the "Pseudo-terminal will not be allocated" warning) = reachable.

4. **If mesh is down / NoState**:
   - Ask the user to **open the Tailscale GUI manually via the Windows Start menu** (the GUI update can leave the service stuck; launching the GUI re-initializes it). `Start-Process` from WSL launches the process but does NOT always fix a stuck service.
   - If still stuck, an **elevated** PowerShell is needed: `Restart-Service tailscale`. Non-elevated WSL shells get `Access denied` — hand this to the user.
   - Proxifier: launch `C:\Program Files (x86)\Proxifier\Proxifier.exe` via `Start-Process` if it isn't running.

5. **Re-run the blocked command** (e.g. `bun run test:ci`) in the background with `nohup ... > log 2>&1 &` and monitor the log — `test:ci` does a long docker build.

## Launch helpers

```bash
PWSH=/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe   # NOT on PATH
"$PWSH" -NoProfile -Command "Start-Process 'C:\Program Files\Tailscale\tailscale.exe'"
"$PWSH" -NoProfile -Command "Start-Process 'C:\Program Files (x86)\Proxifier\Proxifier.exe'"
```

## Gotchas

- `powershell.exe` is not on PATH in this WSL shell — use the full path above.
- tailsocks autostart: HKCU `Run` key → `C:\Users\neil3\tools\tailsocks\start-tailsocks.ps1`. SOCKS port `127.0.0.1:15040`.
- Test the SOCKS path: `curl -s --socks5-hostname 127.0.0.1:15040 -o /dev/null -w "%{http_code} %{errormsg}\n" http://<host>/` — error 4 = mesh down.
- If the mesh is up but Proxifier isn't, curl via the SOCKS proxy still works for testing — Proxifier mainly helps GUI apps/browsers.
