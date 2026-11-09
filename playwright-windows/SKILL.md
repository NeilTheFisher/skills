---
name: "playwright-windows"
description: "Use when an agent needs an isolated browser with real Windows rendering — headed Chrome on Windows driven by Playwright from WSL over CDP. Prefer this over Playwright's bundled WSL/headless browser for performance-sensitive or headed work, and over the user's default browser for tasks that should not touch their real sessions. Covers launching per-session Windows profiles, connecting with Playwright, and clean teardown."
---

# Playwright → Windows Chrome (isolated, headed, via CDP)

WSL's Playwright launches a Linux/headless Chromium with no GPU and no Windows
compositor, so headed/visual work performs poorly. This skill instead launches a
**real Google Chrome on Windows** with its own throwaway profile and drives it with
**Playwright running in WSL** over CDP. Each launch is an isolated session: separate
cookies, storage, extensions, and history.

Why it works: this machine uses `networkingMode=mirrored` in `.wslconfig`, so Windows
and WSL share `127.0.0.1`. A Chrome debug port bound on Windows is reachable from WSL
directly — no port proxy.

## Priority (when several browser-control paths exist)

1. **This skill** — isolated Windows-headed Chrome, one profile per agent/session.
2. **OpenCode `browse`** — when the task needs the user's real signed-in browser.
3. **chrome-devtools-axi** — rare; only when explicitly needed.

Do not use the user's default browser/profile for routine automation, and never kill
or restart the user's running Chrome/Brave.

## Prerequisites

- WSL2 with `networkingMode=mirrored` (check `cat /mnt/c/Users/<you>/.wslconfig`).
- Windows Chrome installed (Brave/Edge also work; see `findChrome`).
- `playwright-core` for the helper — install once:

```bash
bash ~/.agents/skills/playwright-windows/scripts/setup.sh
```

This installs into `~/.cache/playwright-windows` (never inside the skills repo).

## Quick start (library)

```js
import { launch } from '~/.agents/skills/playwright-windows/scripts/win-chrome.mjs';

const h = await launch({ headless: false, url: 'https://example.com' });
// h.browser, h.context, h.page are normal Playwright objects.
await h.page.getByRole('button', { name: 'Sign in' }).click();
await h.page.screenshot({ path: '/tmp/opencode/shot.png' });

await h.close(); // closes the Windows Chrome instance and its profile processes
```

`launch(options)`:

| option | meaning |
|---|---|
| `headless` | `true` → `--headless=new`. Default headed (a real window appears). |
| `url` | navigate the first page after launch |
| `profile` | profile name to reuse (e.g. to keep a login across runs); default random |
| `port` | fixed debug port; default `0` (Chrome picks one, read from `DevToolsActivePort`) |
| `args` | extra Chrome flags |

Always call `h.close()`. `browser.close()` alone only **disconnects** from a
CDP-connected browser and leaves Chrome running.

## CLI (debugging / manual)

```bash
node ~/.agents/skills/playwright-windows/scripts/win-chrome.mjs demo
# -> launches, opens Hacker News, prints title, closes

node ~/.agents/skills/playwright-windows/scripts/win-chrome.mjs launch --url https://example.com
# -> prints { cdpUrl, port, profileWin, url } and leaves Chrome running

node ~/.agents/skills/playwright-windows/scripts/win-chrome.mjs close --port <port>
node ~/.agents/skills/playwright-windows/scripts/win-chrome.mjs close --profile <name|full-win-path>
```

`launch` leaves the browser running and cleans its profile automatically when the window
is closed. Add `--keep-profile` to keep an ephemeral profile.

The `cdpUrl` can be used by any CDP client: `chromium.connectOverCDP(cdpUrl)`.

## Session isolation

- Every `launch()` uses a fresh `C:\Users\<you>\AppData\Local\Temp\pw-<id>` profile.
  Fresh profiles are **signed out**, so account-personalized pages (e.g. the YouTube
  home feed) will look empty/generic — use `browse` when you need the user's signed-in
  state.
- Reuse a profile with `{ profile: 'my-agent' }` to persist logins; do not run two
  instances on the same profile at once (Chrome single-instance handoff).
- **Ephemeral profiles self-clean.** The throwaway profile is deleted when you call
  `h.close()`, when `close --port` shuts it down, and when the user closes the window
  manually (a detached watcher removes it once the debug port stops answering). Named
  profiles are kept for reuse; pass `{ keepProfile: true }` (or `--keep-profile`) to
  keep an ephemeral one for inspection.

## Troubleshooting

- **`Chrome did not expose CDP`** — confirm mirrored networking; confirm Chrome
  launched (a window should appear). The helper uses port `0` and reads
  `DevToolsActivePort`, which avoids Windows Hyper-V excluded port ranges.
- **`powershell.exe not found`** — set `POWERSHELL_EXE` to
  `/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe`.
- **`playwright-core not found`** — run `setup.sh` or set `PLAYWRIGHT_CORE_DIR`.
- **Wrong/old browser** — set `CHROME_WIN_PATH`.
- **Version skew** — Chrome 157 needs a recent `playwright-core` (1.65+ verified).
