---
name: deslop
description: >-
  Removes surface tells that make code read as AI-written and flags structural
  tells a linter misses (boilerplate, hallucinated APIs, over-engineering, code
  that ignores the surrounding repo). Grounded in a Reddit analysis of 11,906
  posts and 11,306 comments across 55 subreddits.
---

# deslop - remove AI-written-code tells

Removes surface cues (chat artifacts, placeholder comments, emoji, swallowed errors,
narrating comments, generic names) and points at the structural tells no regex can catch.
It does not enforce a style. Whether the code is correct and well-factored is still your call.

Every rule is weighted by the verified share of Reddit comments that named it.

## Guardrails

- Keep behavior unchanged unless fixing a clear bug.
- Prefer minimal, focused edits over broad rewrites.
- Keep the final summary concise.

## The over-correction trap

Told to "write clean code," a model over-corrects: defensive checks for impossible cases, a
type on every local, a comment on every block, an abstraction for one caller. Performed
seniority is its own tell. Match the level the surrounding code operates at. Add nothing
the neighboring code would not have.

## Mode 1: Build (prevent slop)

- **The surrounding code.** Give the model the files it will sit next to. This single input
  does more than every other rule combined. The most repeated fix in the data: "make it
  follow the existing code instead of guessing the average."
- **The real requirement**, including failure modes. Vague requirements get the sample-app shape.
- **Calls that exist.** Check every import against real docs.
- **The right level.** A simple if/else is fine.

Full method: `references/fitting-the-codebase.md`

## Mode 2: Audit (remove slop)

**1. Build, type-check, lint.** This catches hallucinated APIs - the #2 tell. No regex can
see them.

**2. Run the scanner** for surface tells:

```bash
python3 scripts/unslop_code_scan.py <path>
python3 scripts/unslop_code_scan.py <path> --severity high
python3 scripts/unslop_code_scan.py <path> --json
```

Covers Python, JS/TS, Java, Go, Rust, Ruby, PHP, C/C++, C#. Exit code = high-severity count.
Lines containing `unslop-ignore` are skipped - use it when a flagged construct is intentional.

**3. Read the diff** for the scanner-blind tells, which are the loudest ones and need eyes:
boilerplate/tutorial shape (18.6%), hallucinated APIs (11.2%), over-engineering (7.8%), code
that ignores the repo (3.5%), mixed skill level (1.9%).

Full catalog with evidence, signatures, and fixes: `references/tells.md`

## Non-code text (commit messages, PR descriptions)

The scanner's `--git` flag can flag tells in commit messages, but **do not auto-fix commit
history**. When `--git` finds issues, report them to the user and let them decide whether to
amend. Apply the same rules to all prose you write (PR descriptions, comments) before
committing - no em dashes, no curly apostrophes, no emoji, no narrating.

## What "fixed" means

Code has less aesthetic latitude than prose. The question is "is it correct, and does it match
what is already in this project?" A fix that swaps the model's default for your own invented
default is not a fix. A fix that makes the line look like the code around it is.

## Reporting

Lead with the verdict and the highest-impact change. Then findings by priority with file:line
and the fix. Close with the slop score and a reminder that the structural tells still need eyes.