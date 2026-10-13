# Environments and gotchas

## Module resolution
Run the driver from inside the repo (or any dir that has `playwright` in
`node_modules`). ESM resolves from the script's own path, so `/tmp/foo.mjs`
cannot `import { chromium } from "playwright"` even if you `cd` into the repo.
An untracked dotfile in the repo root is the low-friction choice.

## Headed on WSL (WSLg)
- Check WSLg: `ls /mnt/wslg` and `/tmp/.X11-unix/X0`.
- Launch with `DISPLAY=:0` and `headless: false`. The window opens on the
  Windows desktop; the user can watch you click.
- If there is no WSLg/X server, fall back to the user's real Chrome via the
  chrome MCP servers (`bunx mcporter call <server>.<tool>`) instead of headed
  Playwright.

## Browser binary missing
`browserType.launch: Executable doesn't exist at .../chromium-<rev>/...` means
the installed Playwright expects a revision the cache lacks. Either:
- `npx playwright install chromium` (downloads the exact revision), or
- pass `executablePath` to a browser you already have:
  - `~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome`
  - snap/system Chrome: `/snap/bin/chromium`, `/usr/bin/google-chrome-stable`

## Self-signed dev certs
- HTTPS pages: `newContext({ ignoreHTTPSErrors: true })`.
- WebSocket/`wss://` to a self-signed origin is blocked even with the context
  option on some setups; also launch with `args: ["--ignore-certificate-errors"]`.
- Mixed content: an `https` page cannot open a plain `ws://` socket. Point at
  the secure endpoint, or serve the page over `http`.

## Overriding runtime config
Apps that read `window._env_` from `/env-config.js` load it via a `<script>`
*tag*, so `page.addInitScript` runs first and gets overwritten. Intercept the
file and rewrite the value instead:

```js
await page.route("**/env-config.js", async (route) => {
  const res = await route.fetch();
  const body = (await res.text()).replace(
    /ROUTER_URL:\s*"[^"]*"/,
    `ROUTER_URL: "${process.env.ROUTER_URL}"`
  );
  await route.fulfill({ response: res, body });
});
```

## Auth-gated routes
If the real route redirects to login for an unauthenticated context, either:
- capture a session once — open headed, log in by hand, then
  `await context.storageState({ path: ".auth/user.json" })` and reuse it with
  `newContext({ storageState })`; or
- build a **minimal harness page** that loads the same client bundle and runs
  only the behaviour under test (e.g. a socket/websocket lifecycle) with a
  skeleton-vs-loaded state. Faster and far less brittle than driving the whole
  shell when the shell needs auth.

## Servers on ports
- Never assume a free port; the project may already use it. Set the dev server's
  port via its env var (e.g. `NODE_PORT_DEV`, `PORT`, `--port`) and check
  `ss -tlnp`.
- A tiny static harness can be served with
  `python3 -m http.server <port> --bind 127.0.0.1` from its directory; grab a
  browser bundle (e.g. the server's `/socket.io/socket.io.js`) next to it.
- First Vite/webpack compile can take a minute; give `webServer.timeout` room.
- Stop everything you started before ending the turn, or list it for the user.
