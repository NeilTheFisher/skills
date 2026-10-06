---
name: playwright-agent-flow
description: >-
  Drive a real browser with Playwright to reproduce or automate a UI flow, then
  promote the working flow into a committed @playwright/test spec that CI can
  run. Use when an agent should open a browser and do something, verify a UI
  flow live, build a repeatable browser test out of a manual reproduction, or
  stand up a headed browser so the user can watch it work. Complements
  `playwright` (ad-hoc CLI driving) and `playwright-automation` (test-authoring
  craft); this skill is the agent loop that turns a live flow into CI.
---

<objective>
Two phases, always in this order.

1. **Drive it live** with a headed Playwright script so the human can watch and
   so you can iterate fast on a real browser. Throw the script away when the
   flow works.
2. **Promote it** to a committed `@playwright/test` spec in the project's e2e
   suite, then wire it into CI.

The failure this prevents: agents that either hack at a UI purely by hand (no
repeatable artifact) or jump straight to writing a spec for a flow they never
actually got working in a browser (a spec that passes locally and flakes in CI).
Get it working live first; the spec is a faithful copy of the steps that worked.
</objective>

## Phase 1 — drive it live

Use the standalone `playwright` library (not `@playwright/test`). It is the
fastest loop and gives you `page.pause()`, headed mode, and ad-hoc logging.

1. **Run from a directory that can resolve `playwright`.** ESM resolves modules
   relative to the script's location, so a script in `/tmp` will fail with
   `Cannot find package 'playwright'`. Put the script inside the repo (an
   untracked dotfile like `.flow.mjs` is fine) or an existing e2e package.
2. **Launch headed so the user can watch.** On WSL use WSLg:
   `DISPLAY=:0 node .flow.mjs`, `headless: false`. On a normal desktop just
   `headless: false`. Only use headless when the user asked for it or you are
   verifying CI behaviour.
3. **Iterate against the real app.** Log `console` and `pageerror`, screenshot
   each step, and use `page.pause()` or `PWDEBUG=1` when a step is ambiguous.
   `waitForTimeout` is fine *here* (exploration) — it is banned in the spec you
   ship.
4. **Make the reproduction deterministic before you trust it.** If the bug only
   appears under a cold cache / cold server / first request, control that
   explicitly (restart the service, clear state) so the red/green run is honest.

A ready-to-edit driver is at `scripts/drive.mjs`; environment gotchas (WSL,
missing browser revision, self-signed certs, overriding runtime config, routes
that need auth) are in `references/environments.md`. Read it before fighting the
browser.

## Phase 2 — promote to a shipped spec

Only once the flow is solid and verified live.

1. **Move the steps into the project's existing e2e suite** (`@playwright/test`),
   using the project's own config and conventions. Do not add a second runner.
2. **Rewrite exploration shortcuts into real waits.** Replace `waitForTimeout`
   with web-first assertions (`await expect(locator).toBeVisible()`), user-facing
   locators (`getByRole`/`getByLabel`/`getByTestId`), and fixtures. Defer to the
   `playwright-automation` skill for authoring craft (POM, fixtures, isolation).
3. **Keep the same decisive check** that proved the flow live (the assertion the
   human watched pass), so red/green stays meaningful.
4. **Wire CI:** headless, fresh context per test, artifacts on failure
   (`trace`, `screenshot`, `video`), and the project's `test:e2e` script.
5. **Prove it end-to-end:** run the committed spec the same way CI will, and
   report the exact command and result.

## Guardrails

- Prefer the project's installed Playwright and existing config over installing
  new tooling.
- Use your own browser context; never drive the user's personal Chrome/profile.
- Headed for the human, headless for CI — say which you are doing and why.
- Clean up anything you start (dev servers, static servers, containers) or tell
  the user exactly what is still running.
- A spec is not done until it has been run through the project's script.

## References

- `references/environments.md` — WSL/headless, browser binaries, certs,
  runtime-config overrides, auth-gated routes, harness fallback.
- `scripts/drive.mjs` — headed driver template to copy and edit.
- Related skills: `playwright` (CLI-first ad-hoc driving), `playwright-automation`
  (test authoring), `diagnosing-bugs` (reproduce → minimise → fix).
