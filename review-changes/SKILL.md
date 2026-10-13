---
name: review-changes
description: Read-only, defect-first review of a code change that reports only findings with a demonstrated failure path. Use when asked to review a diff, branch, commit, or PR, to check work before committing or merging, or when another agent delegates a review. Works in any repo and any agent.
---

# Review Changes

Find the bugs the author would fix if they knew about them. Report nothing else.

The failure mode of code review by an agent is not missing bugs — it is drowning a real bug in
twelve plausible-sounding ones. A short list where every entry is real beats a long list the
author has to triage. Optimise for that.

Read only. Do not edit files, stage, commit, push, or post review comments. Reviewing is the
whole job; if you spot a fix, describe it, don't apply it.

## 1. Establish scope

If the caller named a target, use it. Otherwise work down this list and stop at the first
non-empty result:

| Target | Command |
| --- | --- |
| Uncommitted work | `git diff HEAD` (falls back to unstaged + staged) |
| Staged only | `git diff --cached` |
| Branch vs base | see below |
| Single commit | `git show <sha>` |
| GitHub PR | `gh pr diff <n>` — get the base from `gh pr view <n> --json baseRefName` |

For a branch review, compare what would actually merge, not the raw branch tip — otherwise every
commit that landed on the base since you branched shows up as your change:

```sh
git merge-base HEAD <base-ref>      # then:
git diff <merge-base-sha>...HEAD
```

Resolve `<base-ref>` to the branch's upstream when one exists and is ahead of local; otherwise use
the local base branch. If the branch won't resolve, try its configured upstream explicitly before
reporting the target as unavailable.

State the resolved scope in one line before reviewing. If the diff is empty, say so and stop —
do not review the working tree at large.

## 2. Read

Read `AGENTS.md` and `CLAUDE.md` if present (both, at repo root and in changed directories) —
they often encode the conventions that make something a defect here rather than a style opinion.

Then read the diff in full, plus enough surrounding code to understand each changed path. Diff
hunks lie by omission: a hunk that looks correct in isolation is the most common source of both
missed bugs and false alarms. For anything non-trivial, open the whole file.

Work through the entire diff. Do not stop at the first issue, and do not let an early finding
anchor the rest of the read.

On a large diff, spend your attention where defects concentrate — logic and control flow, error
and edge-case paths, state mutation, concurrency, auth and input validation, data migrations,
and anything touching money, time, or user data. Skim generated files, lockfiles, vendored code,
and pure formatting churn. Say what you skimmed.

## 3. Verify — the step that matters

Every candidate finding must clear this gate before it reaches the report. Do the work; do not
assert it.

For each candidate, construct a **concrete failure scenario**: specific inputs or state, the path
through the code they take, and the wrong result — a crash, wrong value, corrupted or lost data,
a security hole, a hang. Then go back to the code and check the scenario actually reaches the bug:

- Trace the real call sites. `grep` for callers before claiming a signature or contract change
  breaks them.
- Check the guard you think is missing isn't enforced upstream, by a caller, a type, a schema,
  a decorator, or middleware.
- Check the tests. A passing test over the exact path you're worried about means you're probably
  wrong — find out why before reporting.
- Re-read the surrounding code for the invariant that makes the "bug" impossible.

If you cannot make the scenario concrete, drop the finding. If you got it to concrete but only
under an assumption you couldn't confirm, either confirm it or state the assumption inline as
part of the finding.

Report a finding only when all of these hold:

- It affects correctness, security, performance, or maintainability in a way that matters.
- It is discrete and actionable.
- **This change introduced it.** Pre-existing bugs the diff merely touches are out of scope.
- The failure scenario is demonstrable from the code.
- The author would probably fix it.

Do not report: speculative concerns, pre-existing problems, intentional behaviour changes you
disagree with, missing tests for code that has them elsewhere, defensive checks for conditions
that cannot occur, style nits that don't obscure meaning, or anything phrased as "consider
whether…". If your finding needs a hedge to survive, it didn't clear the gate.

## 4. Report

Findings first, most severe first. One entry per issue:

```
[P1] Imperative finding title — path/to/file.ts:142
```

Follow the title with a short paragraph: the concrete scenario that triggers it, and why the
resulting behaviour is wrong. Lead with the trigger, not with a restatement of the code. Cite the
tightest line range that contains the defect, and make sure it overlaps the reviewed diff.

Priorities:

- `P0` — release blocker: data loss, security hole, broken build, or a critical path that fails.
- `P1` — urgent defect, should be fixed before this merges.
- `P2` — ordinary defect, should be fixed.
- `P3` — low impact, still worth fixing.

If nothing clears the gate, write `No findings.` Never manufacture a finding to justify the
review, and never pad P3s to make the list look thorough.

Close with two or three lines: an overall read on the change, then any material test gaps or
residual risks — and anything you deliberately did not review, so the author knows the edges of
what you covered.
