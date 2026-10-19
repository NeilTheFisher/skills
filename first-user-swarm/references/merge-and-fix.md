# Merge, reproduce, fix, prove

## Severity

- **p0** — blocks first success for a persona, loses data, charges money, or
  creates a duplicate/irreversible side effect.
- **p1** — real friction on the path to first success: confusing error, dead end,
  invisible focus, broken mobile layout, ambiguous requirement.
- **p2** — polish: copy, spacing, minor inconsistency, non-blocking annoyance.

## Merge rules

The merge script (`scripts/merge-findings.mjs`) does the mechanical part. Apply
these judgments on top of it:

- Dedupe by `fingerprint` (surface + step + short symptom). Different wording of
  the same issue is one finding.
- Rank by **number of distinct personas that hit it**, then by severity. A p0
  hit by one persona still outranks a p2 hit by five.
- Mark `personaCount == 1` as **weak signal**. Keep it, but do not lead with it
  unless it is p0.
- If five personas abandon at the same step, that is one blocker, not five. Say
  how many personas and which ones.
- Do not average personas into a consensus. The value is that they disagree:
  the breaker finds duplicate submits, the skeptic finds hidden cost, the
  keyboard user finds focus traps.
- Record persona verdicts separately from findings. A persona can succeed while
  still reporting p1 friction.
- The script merges exact and near-identical symptoms automatically and lists
  `possibleDuplicates` (same step + surface, similar wording or a shared
  selector) when it is unsure. Squash those by hand in the report; do not let two
  entries for one bug both reach the fix pass.

Output shape is in `merged.json`; the human report is `report.md`.

## Reproduction gate

No fix without a reproduction. For each merged finding, the orchestrator (or a
single verifier subagent) opens the same build and triggers the described
behavior.

Record:

```json
{ "fingerprint": "...", "reproduced": true, "evidence": "path.png", "trigger": "double-click submit", "notes": "duplicate account created" }
```

Rules:

- Unreproducible → mark `reproduced: false`, drop from the fix list, and say why
  in the report. Synthetic users produce ghosts; do not fix ghosts.
- Partially reproducible (needs the breaker's exact sequence) → keep it, and
  document the trigger sequence.
- Environment artifacts (throttling, slow CI) → decide whether a real user would
  hit it. If not, drop it.
- Before editing any code in `fix` mode, show the user the ranked, reproduced
  list and the proposed scope. Wait for approval unless the user already
  authorized the fix pass.

## Fix pass

- Fix only reproduced p0/p1 findings, plus p2 if requested.
- One pass, scoped: no opportunistic refactors of onboarding.
- If two findings share a root cause, fix the root once and map both
  fingerprints to it.
- Add or update a regression test for each fix when the project has a test
  suite for that surface. Keep it small.
- Record `fingerprint → change` in the report and in the commit/PR description.

## Rerun proof

Rerun all personas on the fixed build, fresh temp dirs and fresh accounts.

Produce `before-after.md`:

```md
| finding | personas before | reproduced | fixed | personas after | verdict |
|---|---|---|---|---|---|
| signup submit disabled, no reason | 3 | yes | yes | 0 | PASS |
| pricing page missing trial terms | 1 | yes | yes | 0 | PASS |
| duplicate account on double-submit | 1 | yes | no  | 1 | FAIL |
```

Rules for judging:

- PASS: every fingerprint that was fixed disappears for the personas that hit it,
  and no new p0 appears.
- PARTIAL: some fixed, some persist, or a new p1 appears.
- FAIL: a p0 persists, or a fix introduced a new p0.
- Verdict changes matter: `abandoned → success` for the affected persona is the
  headline result.
- One rerun is strong evidence, not proof. Personas are stochastic. If the
  result is borderline, run twice and report both.
- Never write "fixed" when the rerun still shows the finding. Say what still
  happens.

## Report template

```md
# First-user swarm — <product> — <date>

URL: <url>   Build: <sha>   Mode: launch | change   Fix pass: yes/no
Success definition: <event>

## Verdicts
| persona | before | after | gave up at |
|---|---|---|---|

## Findings (ranked)
### 1. <symptom> — p1 — 4/7 personas
- Step / surface: ...
- Personas: impatient, mobile, literalist, rage-quitter
- Evidence: [03-signup-disabled.png](impatient/screenshots/03-signup-disabled.png)
- Reproduced: yes
- Trigger: ...
- Fix: ...

## What changed
- ...

## Limitations
- 3G throttling unavailable; mobile run used viewport only.
- Synthetic users find friction, not product-market fit.

## Cleanup
- Test accounts created: qa+<run>-1@… (deleted / listed for deletion)
- Temp dirs removed, browser sessions closed
```

## Test accounts

Use `qa+<run>-<persona>@<domain>` (plus-addressing) or the project's test-email
provider. List every account in the report. Delete via admin API/seed reset when
available; otherwise hand the list to the user. Never reuse a real person's
email.

## Cleanup checklist

- [ ] `playwright-cli close-all` (or `kill-all` for stale sessions)
- [ ] `rm -rf /tmp/qa-swarm/<run>`
- [ ] `rm -rf .playwright-cli` in any repo cwd
- [ ] screenshots only under `output/qa-swarm/<run>/`; nothing committed
- [ ] test accounts deleted or listed
- [ ] test-mode flags / feature toggles reverted
- [ ] no browser, worktree, or test user left behind
