---
name: first-user-swarm
description: >-
  Pre-launch QA with synthetic first-time users: spawn one cheap flash-model
  subagent per persona (impatient, skeptic, mobile-3G, literal non-native
  English, breaker, rage-quitter, keyboard-only), each drives an isolated real
  browser from landing page to first success, then merge, reproduce, fix the
  confirmed issues in one pass, and rerun the same personas to prove it. Use
  when the user says "act as my launch QA lead", asks for first-time user
  agents / synthetic users / a QA swarm, or wants onboarding friction found
  before real users see it.
---

# First-User Swarm

Seven synthetic first-time users hit the same app in parallel. Each runs in its
own browser (never a shared one), knows nothing about the implementation, and
is forced to behave like a real person: limited patience, no source code, no
docs, no retrying until it works. Their friction reports are merged, reproduced,
fixed, and re-tested.

This catches onboarding friction before launch. It does **not** tell you whether
anyone wants the product.

## When to run it

Run it at a milestone, not on every commit:

- before posting a launch link, or before a release that touches
  signup/onboarding/checkout;
- against a preview/staging URL for a branch that changes the first-run flow;
- when the user explicitly asks ("act as my launch QA lead", "spin up first-time
  users", "QA swarm this").

Do not run it on production by default (see Guardrails). Do not run it to judge
product-market fit; synthetic users only find friction.

## Budget

Seven personas is 7 browser sessions and typically 30-80 actions each. State the
cost before starting: personas, max actions per persona, wall clock, and whether
the run includes a fix pass. Defaults: 7 personas, 40 actions each, 10 minutes
each, one fix pass.

## Phase 0 — Preflight

1. Get the target URL and the definition of **first success** (the single event
   that means the persona got value: signed up and saw the dashboard, created a
   project, completed checkout in test mode). If the user cannot name it, stop
   and ask.
2. Classify the environment: `local` / `preview` / `staging` / `prod`. Prod stops
   here unless the user explicitly passes `--allow-prod` and confirms.
3. Check the browser tool:
   ```bash
   command -v npx && npx --yes --package @playwright/cli playwright-cli --version
   ```
   Prefer isolated `playwright-cli` sessions. Do **not** point 7 agents at a
   shared Chrome DevTools MCP instance; they will navigate and close each
   other's tabs. If only a shared browser exists, run personas sequentially.
4. Create the run directory and record the baseline:
   ```bash
   RUN="$(date +%Y%m%d-%H%M%S)"
   ART="output/qa-swarm/$RUN"
   mkdir -p "$ART"
   ```
   Save URL, build/commit SHA, viewport defaults, and the success definition in
   `$ART/run.json`.
5. Decide fix policy: `report` (no edits) or `fix` (default). In `fix` mode the
   merged report must be shown to the user before any code changes.

## Phase 1 — Spawn the swarm

Build one persona card per persona from `references/personas.md` and spawn each
as a subagent with a **fresh empty working directory**:

```bash
mkdir -p "/tmp/qa-swarm/$RUN/<persona>"
```

Rules the orchestrator enforces:

- The subagent receives only: the URL, the persona card, the success definition,
  its output paths, and the browser command. Never the repo path, source files,
  docs, design notes, or the list of other personas.
- The subagent must not read the repository, search the codebase, open
  developer docs, or infer behavior from API responses. If it does, the run is
  invalid; discard that persona's findings.
- One retry per action maximum; a second failure is a finding, not a reason to
  try again.
- Every confusion/stuck/annoyed moment gets a screenshot.

### Spawning per harness

**T3 Code (preferred):** `delegate_task` with an explicit cheap flash model so
the orchestrator does not spend its own budget. Launch all personas `async`,
then let completions wake the thread; collect each result by `taskId`.

```json
{
  "task": "<persona card + contract from references/personas.md>",
  "target": { "providerInstanceId": "opencode", "model": "opencode/deepseek-v4.1-flash-free" },
  "role": "test",
  "mode": "async"
}
```

If that model id is unavailable, pick the cheapest flash model from
`orchestrator_capabilities`; never silently fall back to the orchestrator's
model.

**Claude Code / other harnesses:** use the Task tool with the cheapest flash
model available (Haiku-class), one task per persona, backgrounded.

**No subagent support:** run the persona cards sequentially yourself, but still
in a fresh temp cwd per persona.

### Subagent contract

Each persona writes `output/qa-swarm/<run>/<persona>/findings.json` (screenshots
alongside in `<persona>/screenshots/`) and returns the same content:

```json
{
  "persona": "impatient",
  "verdict": "success | abandoned | blocked",
  "reachedStep": "signup-submit",
  "steps": [{ "n": 3, "action": "clicked Start free", "observed": "spinner, no text", "outcome": "ok | confusing | stuck | annoyed" }],
  "findings": [{
    "fingerprint": "signup|submit|disabled submit with no reason",
    "step": "signup-submit",
    "surface": "signup form",
    "symptom": "Submit stays disabled and nothing explains why",
    "severity": "p0 | p1 | p2",
    "selector": "button[type=submit]",
    "evidence": ["03-signup-disabled.png"]
  }],
  "limitations": ["3G throttling unavailable in this harness"]
}
```

`verdict: abandoned` means the persona quit per its own rules; that is a result,
not a failure. Do not let a subagent "finish anyway".

## Phase 2 — Merge and rank

```bash
# the script lives next to this SKILL.md
node ~/.agents/skills/first-user-swarm/scripts/merge-findings.mjs "$ART" --out "$ART"
```

The script groups by surface + step + symptom (exact and near-identical wording),
counts how many personas hit each issue, ranks by persona count then severity,
and marks single-persona hits as weak signal. Near-misses it refuses to merge are
listed under `possibleDuplicates` in `merged.json`. Read `$ART/report.md`; do not
hand-wave the merge.

Sanity checks before showing the user:

- Five personas abandoning at the same step is one finding, not five.
- A finding only one persona hit is weak signal unless it is p0.
- Separate **blockers that stop first success** from **polish**. The personas
  disagree by design; do not average them into mush.

## Phase 3 — Reproduction gate (required before fixing)

Every merged finding must be reproduced by the orchestrator (or one verifier
subagent) against the same URL before it is eligible for a fix. Record
`reproduced: true/false` plus evidence.

- Unreproducible → drop it and say why. Never "fix" a synthetic ghost.
- Persona-specific behavior (e.g. only the breaker triggers it) is still real if
  a real user could trigger it; keep it and label the trigger.
- If a blocker is reproduced, stop and show the user the ranked list. In `fix`
  mode, get approval for the fix scope before editing.

## Phase 4 — Fix in one pass

Fix only reproduced p0/p1 findings (p2 by request). Keep the diff scoped to the
friction found; do not refactor the onboarding "while here". For each fix,
record the finding fingerprint in the commit/PR description so Phase 5 can
prove it.

## Phase 5 — Rerun and prove

Rerun **all** personas against the fixed build with fresh temp dirs and fresh
test accounts. Then compare:

- previously hit fingerprints that no longer appear for the personas that hit
  them;
- verdict changes (`abandoned` → `success` is the headline);
- new p0 regressions (a fix that breaks another path fails the run).

Report PASS / PARTIAL / FAIL honestly. One rerun is strong evidence, not proof:
personas are stochastic. If a finding persists, say so; do not claim it fixed.
Optionally run twice when the result is borderline.

## Phase 6 — Cleanup and report

Cleanup is part of the run, not optional:

```bash
# close every browser session, then remove throwaway dirs
npx --yes --package @playwright/cli playwright-cli close-all || true
rm -rf "/tmp/qa-swarm/$RUN"
rm -rf .playwright-cli
```

Also:

- Keep only `output/qa-swarm/<run>/` (report, merged.json, screenshots). Add it
  to `.gitignore` if the repo tracks output; never commit screenshots.
- List every test account created (`qa+<run>-N@…`) in the report. Delete them via
  the app's admin API when available; otherwise hand the list to the user.
- Note any configuration changed during testing and revert it.
- Never leave a browser process, temp worktree, or test user behind.

Final report shows: run metadata, per-persona verdicts, merged findings with
persona counts and evidence links, what was fixed, and the before/after table.

## Guardrails

- **Production:** refuse by default. Only proceed with explicit `--allow-prod`
  and a confirmation; never execute real payments, destructive deletes, invites,
  or outbound email. Use test-mode keys.
- **Accounts:** cap at 7; tag emails; no shared passwords in output.
- **Risk controls:** CAPTCHA, bot checks, or rate limits mean "blocked" — report
  it, do not attempt to bypass.
- **Secrets:** never print credentials, tokens, or cookies in findings or
  screenshots.
- **Shared browser:** never drive a browser tab another agent or the user owns.
- **Honesty:** synthetic users catch friction, not willingness to pay. Do not
  present the swarm as market validation.

## Artifacts

```
output/qa-swarm/<run>/
  run.json                    # url, build, success definition, budgets
  merged.json                 # deduped, ranked findings + possibleDuplicates
  report.md                   # human report
  before-after.md             # verdict/finding diff after the fix pass
  <persona>/findings.json     # one per persona
  <persona>/screenshots/*.png # evidence
```

## References

- `references/personas.md` — the seven persona cards, spawn prompt, and rules.
- `references/merge-and-fix.md` — merge ranking, reproduction gate, fix scope,
  rerun proof, and report templates.
