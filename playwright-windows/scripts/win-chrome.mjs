#!/usr/bin/env node
// Launch a Windows-hosted Chrome and drive it with Playwright from WSL over CDP.
//
// Library:
//   import { launch } from './win-chrome.mjs';
//   const { browser, context, page, cdpUrl, profileWin } = await launch({ headless: false, url: 'https://example.com' });
//   ... use normal Playwright API ...
//   await browser.close(); // closes the Windows Chrome instance
//
// CLI:
//   node win-chrome.mjs demo                     # launch -> open HN -> print title -> close
//   node win-chrome.mjs launch [--headless] [--url U] [--profile NAME] [--port N]
//                                               # launch + connect + print JSON, leave running
//   node win-chrome.mjs close --profile NAME     # force-close a profile's chrome processes
//   node win-chrome.mjs close --port N
//
// Requires: WSL2 with networkingMode=mirrored (127.0.0.1 shared with Windows),
// a Windows Chrome/Chromium install, and playwright-core resolvable (see setup.sh).

import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- playwright-core resolution -------------------------------------------------
function resolvePlaywrightCore() {
  const tried = [];
  const attempt = (mod) => {
    try {
      return require(mod);
    } catch (e) {
      tried.push(mod);
      return null;
    }
  };

  if (process.env.PLAYWRIGHT_CORE_DIR) {
    const m = attempt(process.env.PLAYWRIGHT_CORE_DIR);
    if (m) return m;
  }
  const home = os.homedir();
  const candidates = [
    'playwright-core',
    path.join(home, '.cache/playwright-windows/node_modules/playwright-core'),
    path.join(process.cwd(), 'node_modules/playwright-core'),
  ];
  for (const c of candidates) {
    const m = attempt(c);
    if (m) return m;
  }
  // Last resort: any npx cache copy.
  try {
    const npxRoot = path.join(home, '.npm/_npx');
    for (const dir of fs.readdirSync(npxRoot)) {
      const p = path.join(npxRoot, dir, 'node_modules/playwright-core');
      const m = attempt(p);
      if (m) return m;
    }
  } catch {}
  throw new Error(
    'playwright-core not found. Run scripts/setup.sh, or set PLAYWRIGHT_CORE_DIR. Tried: ' +
      tried.join(', '),
  );
}

// --- Windows path helpers -------------------------------------------------------
function findPowershell() {
  const candidates = [
    process.env.POWERSHELL_EXE,
    '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
    '/mnt/c/Windows/SysWOW64/WindowsPowerShell/v1.0/powershell.exe',
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  try {
    return execFileSync('where.exe', ['powershell.exe'], { encoding: 'utf8', cwd: '/mnt/c/Windows' })
      .split(/\r?\n/)[0]
      .trim();
  } catch {}
  throw new Error('powershell.exe not found. Set POWERSHELL_EXE.');
}

const PS = {
  get exe() {
    return (PS._exe ||= findPowershell());
  },
};

function windowsTemp() {
  if (process.env.PW_WIN_TEMP) return process.env.PW_WIN_TEMP;
  const out = execFileSync(
    PS.exe,
    ['-NoProfile', '-NonInteractive', '-Command', '[Console]::Out.Write($env:TEMP)'],
    { encoding: 'utf8', cwd: '/mnt/c/Windows' },
  ).trim();
  if (!out) throw new Error('Could not determine Windows %TEMP%');
  return out;
}

function toWsl(winPath) {
  return winPath
    .replace(/^([A-Za-z]):\\?/, (_, d) => `/mnt/${d.toLowerCase()}/`)
    .replace(/\\/g, '/');
}

function findChrome() {
  const candidates = [
    process.env.CHROME_WIN_PATH,
    '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
    '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/mnt/c/Program Files/Chromium/Application/chrome.exe',
    '/mnt/c/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
    '/mnt/c/Program Files/BraveSoftware/Brave-Browser-Beta/Application/brave.exe',
    '/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('No Windows Chrome/Chromium found. Set CHROME_WIN_PATH.');
}

// Chrome with --remote-debugging-port=0 writes the chosen port to
// <user-data-dir>/DevToolsActivePort. Reading it avoids Windows' excluded
// port ranges (Hyper-V) that can silently stop Chrome binding a chosen port.
async function waitForActivePort(profileWsl, timeoutMs = 15000) {
  const file = path.join(profileWsl, 'DevToolsActivePort');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const port = Number(fs.readFileSync(file, 'utf8').split(/\r?\n/)[0].trim());
      if (port > 0) return port;
    } catch {}
    await sleep(120);
  }
  throw new Error(`Chrome did not write DevToolsActivePort in ${profileWsl}`);
}

async function waitForCdp(port, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return await r.json();
    } catch (e) {
      lastErr = e;
    }
    await sleep(150);
  }
  throw new Error(
    `Chrome did not expose CDP on 127.0.0.1:${port}. ` +
      `Check WSL networkingMode=mirrored and that Chrome launched. Last error: ${lastErr?.message}`,
  );
}

// --- public API -----------------------------------------------------------------
export async function launch(opts = {}) {
  const { chromium } = resolvePlaywrightCore();
  const chrome = findChrome();
  const tempWin = windowsTemp();
  const profileName =
    opts.profile || `pw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const profileWin = path.win32.join(tempWin, profileName);
  const profileWsl = toWsl(profileWin);
  fs.mkdirSync(profileWsl, { recursive: true });

  const requestedPort = opts.port || 0;
  const args = [
    `--remote-debugging-port=${requestedPort}`,
    `--user-data-dir=${profileWin}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-features=Translate,MediaRouter',
    '--disable-background-networking',
  ];
  if (opts.headless) args.push('--headless=new');
  if (opts.args) args.push(...opts.args);
  args.push('about:blank');

  const child = spawn(chrome, args, { detached: true, stdio: 'ignore' });
  child.unref();

  const port = requestedPort || (await waitForActivePort(profileWsl));
  await waitForCdp(port);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context = opts.context || browser.contexts()[0];
  if (!context) throw new Error('connectOverCDP returned no browser context');

  let page = context.pages().find((p) => p.url() !== 'about:blank') || context.pages()[0];
  if (!page) page = await context.newPage();
  if (opts.url) {
    await page.goto(opts.url, { waitUntil: 'domcontentloaded' }).catch(() => {});
  }

  const ephemeral = !opts.profile;
  const autoClean = ephemeral && opts.autoClean !== false && opts.keepProfile !== true;
  if (ephemeral && opts.keepProfile !== true && opts.watch !== false) {
    spawnWatcher(port, profileWsl);
  }

  let finished = false;
  browser.on('disconnected', () => {
    if (finished) return;
    finished = true;
    if (!autoClean) return;
    // `browser.close()` only disconnects a CDP browser; don't delete a profile whose
    // Chrome is still serving its debug port.
    setTimeout(async () => {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/json/version`, {
          signal: AbortSignal.timeout(1500),
        });
        if (r.ok) return;
      } catch {}
      removeProfileDir(profileWsl);
    }, 900);
  });

  async function close() {
    finished = true;
    try {
      await browser.close();
    } catch {}
    closeProfile(profileWin);
    if (autoClean) await removeProfileDirWhenFree(profileWsl);
  }

  return {
    browser,
    context,
    page,
    cdpUrl: `http://127.0.0.1:${port}`,
    port,
    profileWin,
    profileWsl,
    ephemeral,
    autoClean,
    close,
  };
}

export function closeProfile(profileWin) {
  const needle = String(profileWin).replace(/'/g, "''");
  try {
    execFileSync(
      PS.exe,
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='brave.exe' OR Name='msedge.exe'" | ` +
          `Where-Object { $_.CommandLine -like '*${needle}*' } | ` +
          `ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
      ],
      { cwd: '/mnt/c/Windows', stdio: 'ignore' },
    );
  } catch {}
}

function removeProfileDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    return true;
  } catch {
    return false;
  }
}

async function removeProfileDirWhenFree(dir) {
  for (let i = 0; i < 30; i++) {
    if (!fs.existsSync(dir)) return true;
    if (removeProfileDir(dir)) return true;
    await sleep(250);
  }
  return !fs.existsSync(dir);
}

function profileFromPort(port) {
  try {
    const out = execFileSync(
      PS.exe,
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='brave.exe' OR Name='msedge.exe'" | Select-Object -ExpandProperty CommandLine`,
      ],
      { encoding: 'utf8', cwd: '/mnt/c/Windows' },
    );
    for (const line of out.split(/\r?\n/)) {
      const m = /--user-data-dir=(?:"([^"]+)"|([^ ]+))/.exec(line);
      if (!m) continue;
      const winDir = m[1] || m[2];
      try {
        const active = fs.readFileSync(path.join(toWsl(winDir), 'DevToolsActivePort'), 'utf8');
        if (Number(active.split(/\r?\n/)[0]) === port) return winDir;
      } catch {}
    }
  } catch {}
  return null;
}

function spawnWatcher(port, profileWsl) {
  const watcher = path.join(path.dirname(fileURLToPath(import.meta.url)), 'profile-watcher.mjs');
  spawn(process.execPath, [watcher, String(port), profileWsl], {
    detached: true,
    stdio: 'ignore',
  }).unref();
}

// --- CLI ------------------------------------------------------------------------
async function closeViaCdp(port) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/json/version`);
    if (!r.ok) return false;
    const { webSocketDebuggerUrl } = await r.json();
    if (!webSocketDebuggerUrl) return false;
    await new Promise((resolve) => {
      const ws = new WebSocket(webSocketDebuggerUrl);
      const done = () => {
        clearTimeout(timer);
        try { ws.close(); } catch {}
        resolve();
      };
      const timer = setTimeout(done, 3000);
      ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
      ws.onclose = done;
      ws.onerror = done;
    });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const [, , cmd = 'demo', ...rest] = process.argv;
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--headless') flags.headless = true;
    else if (a === '--url') flags.url = rest[++i];
    else if (a === '--profile') flags.profile = rest[++i];
    else if (a === '--port') flags.port = Number(rest[++i]);
    else if (a === '--keep-profile') flags.keepProfile = true;
  }

  if (cmd === 'demo') {
    const handle = await launch({
      headless: !!flags.headless,
      url: 'https://news.ycombinator.com/',
    });
    const { page, cdpUrl } = handle;
    const title = await page.title();
    const first = await page.$eval('.titleline > a', (a) => a.textContent.trim()).catch(() => null);
    console.log(JSON.stringify({ cdpUrl, title, first }, null, 2));
    await handle.close();
    return;
  }

  if (cmd === 'launch') {
    const h = await launch({ ...flags, url: flags.url, autoClean: false });
    console.log(
      JSON.stringify(
        {
          cdpUrl: h.cdpUrl,
          port: h.port,
          profileWin: h.profileWin,
          url: h.page.url(),
          autoCleanupOnManualClose: h.ephemeral && !flags.keepProfile,
        },
        null,
        2,
      ),
    );
    // Detach without closing Chrome, then exit so the process does not hang on the CDP socket.
    await h.browser.close().catch(() => {});
    process.exit(0);
  }

  if (cmd === 'close') {
    if (flags.port) {
      const prof = profileFromPort(flags.port);
      if (!(await closeViaCdp(flags.port))) {
        execFileSync(PS.exe, [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `$p = (Get-NetTCPConnection -State Listen -LocalPort ${flags.port} -ErrorAction SilentlyContinue).OwningProcess | Select-Object -First 1; if ($p) { taskkill /T /F /PID $p 2>&1 | Out-Null }`,
        ], { cwd: '/mnt/c/Windows', stdio: 'ignore' });
      }
      if (prof && !flags.keepProfile) {
        await sleep(1200);
        const wsl = toWsl(prof);
        const gone = await removeProfileDirWhenFree(wsl);
        console.error(gone ? `removed ${wsl}` : `could not remove ${wsl}`);
      }
      return;
    }
    const prof = flags.profile || '';
    const target = /[\\/]/.test(prof) || /^[A-Za-z]:/.test(prof)
      ? prof
      : path.win32.join(windowsTemp(), prof);
    closeProfile(target);
    if (!flags.keepProfile) await removeProfileDirWhenFree(toWsl(target));
    return;
  }

  console.error(`Unknown command: ${cmd}. Use demo | launch | close.`);
  process.exit(2);
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((e) => {
    console.error('ERROR:', e.message);
    process.exit(1);
  });
}
