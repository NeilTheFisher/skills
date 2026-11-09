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
  craft (playwright-automation).
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

## What gets written

```
<recording-dir>/
  state-a.json, state-b.json    cookies and localStorage per window
  flow-a.spec.ts, flow-b.spec.ts live-generated @playwright/test code
  codegen-a.log, codegen-b.log  process output
```

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

## Done when

- `state-*.json` and `flow-*.spec.ts` exist for every window that recorded.
- `replay.sh <recording-dir>` runs headlessly and reproduces the flow without
  a login step.
- Any spec moved into a repo passes `npx playwright test --list` and contains
  no `waitForTimeout`.
