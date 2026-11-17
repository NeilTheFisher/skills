---
name: record-flow
description: >-
  Set up isolated Playwright codegen windows so the user can record an E2E flow
  by hand in a real browser, keep each window's session state and generated
  spec, and replay the recording headlessly later or promote it into a
  committed @playwright/test spec. Use when the user says "record this flow",
  "let me drive it", "save this session", "set up two browsers", "record and
  replay", or wants a repeatable test built from a manual pass. Not for an
  agent driving a flow itself (playwright-agent-flow) or for test-authoring
  craft (playwright-automation). For a repeated read-only lookup that an agent
  should replay cheaply, use agent-browser saved flows instead
  (references/saved-web-flows.md).
---

# Record a flow

The user drives. You only supply the browsers, the recording, and the storage
state, then keep the artifacts so the flow can be replayed or committed.

Use this when a flow is easier to demonstrate once than to describe, when the
login is awkward to script (OTP, SSO), or when two accounts have to interact
(two-user call, chat, invite).

## Quick start

```bash
~/.agents/skills/record-flow/scripts/record.sh https://app.example.com 2
# prints the recording directory, then leave the user alone with the windows
```

The script opens N isolated Chrome windows, each with the Playwright Inspector
attached and a live-generated `@playwright/test` file. The user logs in and
clicks through the flow. When they are done:

```bash
~/.agents/skills/record-flow/scripts/stop.sh <recording-dir>
```

SIGINT stops each window gracefully, which is what makes Playwright write
`state-<id>.json`. Killing the process any other way loses the session.

Replay any recording headlessly:

```bash
~/.agents/skills/record-flow/scripts/replay.sh <recording-dir>
```

The first replay installs `@playwright/test` into the recording directory (a few
seconds) and writes a `playwright.config.ts` there. The config uses the same
system Chrome channel as codegen and loads the spec's matching `state-<id>.json`,
so replay needs neither a Playwright browser download nor a manual storage line
in the generated spec.

## Two kinds of replay

A Playwright spec is the right artifact when the task should *assert* something
and fail CI. When the task is instead a repeated read-only lookup an agent
should run cheaply, record it as an agent-browser saved flow and replay the
request instead of the page:

```bash
agent-browser --capture flow open <url>   # do the task once
agent-browser flow save <name> --param q=<value you typed>
agent-browser flow run <name> --param q=<new value> --fields a,b
```

`references/saved-web-flows.md` covers when that fits, the replay tiers, and
the auth and write caveats. Keep the two artifacts separate: a saved flow is
not a test and does not replace the spec.

## What gets written

```
<recording-dir>/
  state-a.json, state-b.json    cookies and localStorage per window
  flow-a.spec.ts, flow-b.spec.ts live-generated @playwright/test code
  codegen-a.log, codegen-b.log  process output
```

Replay adds `package.json`, `playwright.config.ts` and `node_modules/` to the
same directory on first use; they are not part of the recording.

`state-*.json` is the valuable artifact: it lets a replay skip the login, which
is usually the part that cannot be scripted.

## Choices that matter

- **`--channel=chrome`** uses the system Chrome, so nothing is downloaded and
  the user sees a normal browser. Do not switch to bundled Chromium unless the
  system browser is missing.
- **One window per account.** Each codegen run gets its own fresh context, so
  two windows are isolated even without separate profiles. Do not reuse one
  window for two users.
- **`--load-storage`** rehydrates an old session, which is how a second pass
  (for example after a deploy) starts already logged in.
- **`--output`** is what makes the recording durable. Without it the code only
  exists in the Inspector window and dies with it.
- Default location is `~/flow-recordings/<timestamp>/`. Pass a third argument
  to record.sh to choose another.

## Gotchas

- **Reload after a deploy.** A running window keeps the old JavaScript bundle.
  Close and relaunch with `--load-storage`, or the user hard-reloads. Confirm
  the served asset name changed rather than assuming the deploy took.
- **Single-tab app locks.** Apps that use `BroadcastChannel` or a localStorage
  lock show "this is open in another tab, continue here" when a second session
  with the same account starts. That is expected; click it in the window that
  should own the session.
- **No login scripting.** Record after login. The OTP and SSO steps are exactly
  what state files exist to avoid repeating.
- **Generated code is a draft.** Codegen emits CSS and nth-child locators.
  Before committing, replace them with `getByRole`/`getByLabel` and delete any
  `waitForTimeout` (see `playwright-automation`).
- **Do not record in a session another thread owns.** Separate output
  directories per recorder; one browser per user-data-dir.

## Promote to a committed test

1. Move the spec into the project's `e2e/` tree.
2. Read the storage state from a fixture rather than a relative path, for
   example `test.use({ storageState: '.auth/user.json' })`, and seed that file
   once with a setup project.
3. Replace generated locators and assertions with intent-revealing ones, and
   split multi-window flows into two projects or two contexts inside one test.
4. Wire it into CI as described in `playwright-automation`.

## First live run: improve this skill

The replay path is verified, but the human recording UX has not been exercised
on a real app yet. The first live use should leave this skill better than it
found it, in the same session:

- Record the app and route, the login method, and whether `stop.sh` wrote
  `state-<id>.json`.
- Note every step that needed a manual wait, a reload, or a locator the
  inspector got wrong.
- Run `replay.sh`. If it fails, fix the script or the spec, then add a gotcha
  here with the cause, not just the symptom.
- Fix the known `stop.sh` issue on that run: it signals every codegen process
  on the machine instead of only the ones in the recording directory.

## Done when

- `state-*.json` and `flow-*.spec.ts` exist for every window that recorded.
- `replay.sh <recording-dir>` runs headlessly and reproduces the flow without
  a login step.
- Any spec moved into a repo passes `npx playwright test --list` and contains
  no `waitForTimeout`.
