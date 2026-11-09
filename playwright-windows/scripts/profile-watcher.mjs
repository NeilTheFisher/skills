#!/usr/bin/env node
// Watches a launched Chrome's CDP port and deletes its throwaway profile once the
// browser is gone (e.g. the user closed the window manually). Started detached by
// `win-chrome.mjs launch`; exit is silent.
import fs from 'node:fs';

const [portArg, dir] = process.argv.slice(2);
const port = Number(portArg);
if (!port || !dir) process.exit(2);

let armed = false;
let failures = 0;

setTimeout(() => {
  armed = true;
}, 4000);

setInterval(async () => {
  if (!armed) return;
  let up = false;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(2000),
    });
    up = r.ok;
  } catch {}
  if (up) {
    failures = 0;
    return;
  }
  if (++failures >= 4) {
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
    } catch {}
    process.exit(0);
  }
}, 1500);
